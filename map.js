import { searchPodcast } from "./spotifyfetch.js";

const podcastNameInput = document.getElementById("podcast-input");
const historyList = document.getElementById("history-list");

const emitUiUpdate = () => {
    window.dispatchEvent(new CustomEvent("stepcast:ui-updated"));
};

const emitStatus = (title, message, tone = "default") => {
    window.dispatchEvent(new CustomEvent("stepcast:status", {
        detail: {
            title,
            message,
            tone,
        },
    }));
};

export class Map {
    constructor(localStorageHandler, podcastList) {
        this.mapTypes = {
            open: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            topographic: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        };

        this.map = L.map("map").setView([59.3293, 18.0686], 10);
        this.baseLayer = L.tileLayer(this.mapTypes.open, {
            maxZoom: 20,
        }).addTo(this.map);

        this.markers = [];
        this.localStorageHandler = localStorageHandler;
        this.allowMarkerPlacement = true;
        this.isHoveringPolyline = false;
        this.isPolylineSelected = false;
        this.selectedWalk = null;
        this.visibleWalks = [];
        this.cursorHoversMap = false;
        this.sessionActions = [];
        this.podcastList = podcastList;
    }

    changeMapType(mapType) {
        if (!this.mapTypes[mapType]) {
            return;
        }

        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                this.map.removeLayer(layer);
            }
        });

        this.baseLayer = L.tileLayer(this.mapTypes[mapType], {
            maxZoom: 20,
        }).addTo(this.map);
    }

    findMatchingPodcastIndex(podcastName) {
        return this.podcastList.findIndex((podcast) => podcast.name === podcastName);
    }

    getWalkColor(walk) {
        return walk?.podcast?.color || "#176b73";
    }

    escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    calculateWalkDistance(points = []) {
        let distance = 0;

        for (let index = 0; index < points.length - 1; index += 1) {
            const pointA = L.latLng(points[index].lat, points[index].lng);
            const pointB = L.latLng(points[index + 1].lat, points[index + 1].lng);
            distance += pointA.distanceTo(pointB);
        }

        return distance;
    }

    formatWalkDate(value) {
        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    }

    getWalkInitials(walk) {
        return String(walk?.podcastName || "SC")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((segment) => segment[0]?.toUpperCase() || "")
            .join("");
    }

    renderEmptyHistoryState() {
        historyList.innerHTML = `
            <li class="empty-state">
                <strong>No saved walks yet</strong>
                <p>Plot a route on the map or record one live with GPS, then save it to start building your library.</p>
            </li>
        `;
    }

    showExistingWalks() {
        const walks = this.localStorageHandler.retrieveWalksFromLocalStorage();

        historyList.innerHTML = "";
        this.visibleWalks.forEach((walk) => {
            this.removeWalkFromMap(walk);
        });

        this.visibleWalks = [];
        this.selectedWalk = null;
        this.isPolylineSelected = false;

        if (walks.length === 0) {
            this.renderEmptyHistoryState();
            emitUiUpdate();
            return;
        }

        walks.forEach((walk) => {
            this.showWalkOnMap(walk);
            this.showWalkInHistoryList(walk);
        });

        emitUiUpdate();
    }

    showWalkInHistoryList(walk) {
        const newHistoryItem = document.createElement("li");
        const distance = this.calculateWalkDistance(walk.points || []);
        const displayColor = this.getWalkColor(walk);
        const safeName = this.escapeHtml(walk.podcastName);
        const safeDate = this.escapeHtml(this.formatWalkDate(walk.date));
        const initials = this.escapeHtml(this.getWalkInitials(walk));

        newHistoryItem.className = "history-item";
        newHistoryItem.dataset.walkId = walk.id;

        const artworkMarkup = walk.podcastFetchAdress
            ? `<img class="history-artwork" src="${this.escapeHtml(walk.podcastFetchAdress)}" alt="${safeName} cover art">`
            : `<div class="history-artwork history-artwork--fallback" style="border: 1px solid ${displayColor};">${initials}</div>`;

        newHistoryItem.innerHTML = `
            <article class="history-card">
                ${artworkMarkup}
                <div class="history-card__body">
                    <div class="history-card__header">
                        <div>
                            <p class="history-card__title">${safeName}</p>
                            <p class="history-card__subtitle">${safeDate}</p>
                        </div>
                    </div>
                    <div class="history-card__metrics">
                        <span class="history-metric">${(distance / 1000).toFixed(2)} km</span>
                        <span class="history-metric">${(walk.points || []).length} points</span>
                    </div>
                    <div class="history-card__actions">
                        <button class="history-action history-action--focus" type="button">Focus route</button>
                        <button class="history-action history-action--danger" type="button">Delete</button>
                    </div>
                </div>
            </article>
        `;

        const focusButton = newHistoryItem.querySelector(".history-action--focus");
        const deleteButton = newHistoryItem.querySelector(".history-action--danger");
        const card = newHistoryItem.querySelector(".history-card");

        card.addEventListener("click", (event) => {
            if (event.target.closest("button")) {
                return;
            }

            if (this.selectedWalk === walk) {
                this.deselectWalk(walk, displayColor);
                return;
            }

            if (this.selectedWalk) {
                this.deselectWalk(this.selectedWalk, this.getWalkColor(this.selectedWalk));
            }

            this.selectWalk(walk);
            this.focusWalk(walk);
        });

        focusButton.addEventListener("click", (event) => {
            event.stopPropagation();

            if (this.selectedWalk && this.selectedWalk !== walk) {
                this.deselectWalk(this.selectedWalk, this.getWalkColor(this.selectedWalk));
            }

            if (this.selectedWalk !== walk) {
                this.selectWalk(walk);
            }

            this.focusWalk(walk);
        });

        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.localStorageHandler.removeWalkFromLocalStorage(walk);
            this.showExistingWalks();
            emitStatus("Walk deleted", `${walk.podcastName} was removed from your library.`, "warning");
        });

        walk.historyListItem = newHistoryItem;
        historyList.appendChild(newHistoryItem);
        return distance;
    }

    showTooltip(walk, color) {
        const safeName = this.escapeHtml(walk.podcastName);
        const safeColor = this.escapeHtml(color);
        const safeLogo = this.escapeHtml(walk.podcastFetchAdress);

        const tooltipContent = walk.podcastFetchAdress
            ? `
                <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;">
                    <img src="${safeLogo}" alt="${safeName} logo" style="max-width:52px;max-height:52px;object-fit:cover;border-radius:12px;">
                    <div style="font-weight:700;color:${safeColor};">${safeName}</div>
                </div>
            `
            : `
                <div style="font-weight:700;color:${safeColor};text-align:center;">${safeName}</div>
            `;

        walk.polyline.bindTooltip(tooltipContent, {
            permanent: false,
            sticky: true,
            direction: "top",
        }).openTooltip();
    }

    showWalkOnMap(walk) {
        if (!Array.isArray(walk?.points) || walk.points.length === 0) {
            return;
        }

        const displayColor = this.getWalkColor(walk);
        walk.polyline = L.polyline(walk.points, {
            color: displayColor,
            weight: 5,
            opacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
        }).addTo(this.map);

        this.visibleWalks.push(walk);

        walk.polyline.on("mouseover", () => {
            this.allowMarkerPlacement = false;

            if (walk !== this.selectedWalk) {
                this.showTooltip(walk, displayColor);
                walk.polyline.setStyle({
                    color: "#ea6c2f",
                    weight: 6,
                    opacity: 1,
                });
            }
        });

        walk.polyline.on("mouseout", () => {
            this.allowMarkerPlacement = true;
            walk.polyline.closeTooltip();

            if (walk !== this.selectedWalk) {
                walk.polyline.setStyle({
                    color: displayColor,
                    weight: 5,
                    opacity: 0.92,
                });
            }
        });

        walk.polyline.on("click", (event) => {
            if (event?.originalEvent) {
                L.DomEvent.stopPropagation(event.originalEvent);
            }

            if (this.selectedWalk === walk) {
                this.deselectWalk(walk, displayColor);
                return;
            }

            if (this.selectedWalk) {
                this.deselectWalk(this.selectedWalk, this.getWalkColor(this.selectedWalk));
            }

            this.selectWalk(walk);
            this.focusWalk(walk);
        });
    }

    focusWalk(walk) {
        if (!walk?.polyline) {
            return;
        }

        const bounds = walk.polyline.getBounds();
        if (bounds.isValid()) {
            this.map.fitBounds(bounds.pad(0.3), {
                animate: true,
            });
        }
    }

    removeWalkFromMap(walk) {
        if (walk?.polyline && this.map.hasLayer(walk.polyline)) {
            this.map.removeLayer(walk.polyline);
        }
    }

    async createNewWalk(pointsInput) {
        const points = Array.isArray(pointsInput)
            ? pointsInput.filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng))
            : this.markers.map((marker) => marker.latLng);
        const podcastName = podcastNameInput.value.trim();

        if (!podcastName || points.length === 0) {
            return null;
        }

        const podcastIndex = this.findMatchingPodcastIndex(podcastName);
        const podcast = podcastIndex >= 0
            ? this.podcastList[podcastIndex]
            : {
                name: podcastName,
                color: "#176b73",
                logoUrl: "",
                path: [],
            };

        const walkObj = {
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            podcastName,
            podcastIndex,
            podcast,
            podcastFetchAdress: podcast.logoUrl || await searchPodcast(podcastName),
            points,
            date: new Date().toISOString(),
            polyline: null,
        };

        for (const marker of this.markers) {
            if (this.map.hasLayer(marker.marker)) {
                this.map.removeLayer(marker.marker);
            }
        }

        podcastNameInput.value = "";
        this.markers = [];
        emitUiUpdate();
        return walkObj;
    }

    placeMarker(event) {
        if (!this.allowMarkerPlacement || this.isHoveringPolyline || this.isPolylineSelected) {
            return;
        }

        const latLng = event.latlng;
        const marker = L.circleMarker(latLng, {
            radius: 8,
            color: "#fff7f1",
            weight: 3,
            fillColor: "#ea6c2f",
            fillOpacity: 1,
        }).addTo(this.map);

        this.markers.push({ marker, latLng });
        this.sessionActions.push({ type: "placed-marker" });
        emitUiUpdate();
    }

    undo() {
        if (this.sessionActions.length <= 0) {
            return;
        }

        const lastAction = this.sessionActions[this.sessionActions.length - 1];

        if (lastAction.type === "placed-marker") {
            if (this.markers.length > 0) {
                const lastMarker = this.markers.pop();
                this.map.removeLayer(lastMarker.marker);
                this.sessionActions.pop();
                emitStatus("Draft point removed", "The last plotted point was removed from your draft route.", "warning");
                emitUiUpdate();
            }

            return;
        }

        if (lastAction.type === "created-walk") {
            const storedWalks = this.localStorageHandler.retrieveWalksFromLocalStorage();
            const walkToRemove = storedWalks.find((walk) => walk.id === lastAction.walkId);

            if (!walkToRemove) {
                this.sessionActions.pop();
                emitUiUpdate();
                return;
            }

            if (!window.confirm(`Remove the last saved walk for "${walkToRemove.podcastName}"?`)) {
                return;
            }

            this.localStorageHandler.removeWalkFromLocalStorage({ id: lastAction.walkId });
            this.sessionActions.pop();
            this.showExistingWalks();
            emitStatus("Last save removed", `${walkToRemove.podcastName} was removed from your library.`, "warning");
        }
    }

    selectWalk(walk) {
        walk.polyline.setStyle({
            color: "#ea6c2f",
            weight: 7,
            opacity: 1,
        });

        walk.polyline.bringToFront();
        this.selectedWalk = walk;
        this.isPolylineSelected = true;
        walk.historyListItem?.classList.add("is-selected");
        emitUiUpdate();
    }

    deselectWalk(walk, color) {
        walk.polyline.setStyle({
            color,
            weight: 5,
            opacity: 0.92,
        });

        walk.historyListItem?.classList.remove("is-selected");
        this.selectedWalk = null;
        this.isPolylineSelected = false;
        emitUiUpdate();
    }

    async createSaveShowWalk(points) {
        const newWalk = points !== undefined
            ? await this.createNewWalk(points)
            : await this.createNewWalk();

        if (!newWalk) {
            emitStatus(
                "Walk details missing",
                "Enter a podcast title and record at least one route point before saving.",
                "warning",
            );
            return false;
        }

        this.localStorageHandler.saveWalkToLocalStorage(newWalk);
        this.sessionActions.push({
            type: "created-walk",
            walkId: newWalk.id,
        });
        this.showExistingWalks();
        emitStatus("Walk saved", `${newWalk.podcastName} was added to your library.`, "success");
        return true;
    }
}
