import { searchPodcast } from "./spotifyfetch.js";

const podcastNameInput = document.getElementById('podcast-input');
const historyList = document.getElementById('history-list');

export class Map {
    constructor(localStorageHandler, podcastList) {
        this.mapTypes = {
            open: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            darkMapLayer: 'https://{s}.tile.stamen.com/terrain/{z}/{x}/{y}.png',
            light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            satelite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            topographic: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        }

        this.map = L.map('map').setView([59.3293, 18.0686], 10); // Coordinates of Stockholm, Sweden for example
        L.tileLayer(this.mapTypes.open).addTo(this.map);

        this.markers = [];
        this.localStorageHandler = localStorageHandler;

        this.allowMarkerPlacement = true;
        this.isHoveringPolyline = false;
        this.isPolylineSelected = false;
        this.selectedPolyline;
        this.selectedWalk = null;
        this.visibleWalks = [];
        this.cursorHoversMap = false;
        this.sessionActions = [];

        this.podcastList = podcastList;
    }

    changeMapType(mapType) {
        // Remove the existing tile layer
        this.map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                this.map.removeLayer(layer);
            }
        });

        // Add the new tile layer based on the passed mapType
        L.tileLayer(this.mapTypes[mapType]).addTo(this.map);
    }

    findMatchingPodcastIndex(podcastName) {
        return this.podcastList.findIndex((podcast) => podcast.name === podcastName);
    }

    getWalkColor(walk) {
        return walk?.podcast?.color || '#000000';
    }

    showExistingWalks() {
        // Retrieve walks from local storage
        const walks = this.localStorageHandler.retrieveWalksFromLocalStorage();

        // Remove all previous walks from map and list
        historyList.innerHTML = '';

        this.visibleWalks.forEach(walk => {
            this.removeWalkFromMap(walk);            
        });
        this.visibleWalks = [];
        this.selectedWalk = null;

        // Add all walks to map and list
        if (walks.length > 0) {
            walks.forEach(walk => {
                this.showWalkOnMap(walk);
                this.showWalkInHistoryList(walk);
            });
        }
    }

    showWalkInHistoryList(walk) {
        const newHistoryItem = document.createElement('li');
        
        // Calculate distance if there are multiple points
        let distance = 0;
        if (walk.points && walk.points.length > 1) {
            for (let i = 0; i < walk.points.length - 1; i++) {
                const pointA = L.latLng(walk.points[i].lat, walk.points[i].lng);
                const pointB = L.latLng(walk.points[i + 1].lat, walk.points[i + 1].lng);
    
                // Calculate the distance between pointA and pointB
                distance += pointA.distanceTo(pointB);  // This gives the distance in meters
            }
        }
    
        // Format the date nicely
        const date = new Date(walk.date);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    
        // Show podcast name, distance, and date
        newHistoryItem.textContent = `${walk.podcastName} | Distance: ${(distance / 1000).toFixed(2)} km | Date: ${formattedDate}`;
    
        // Create the delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️';
        deleteButton.classList.add('deleteBtn');
        
        // Add delete functionality
        deleteButton.onclick = () => {
            this.localStorageHandler.removeWalkFromLocalStorage(walk);
            this.showExistingWalks();
        };
    
        // Append the delete button to the history item
        newHistoryItem.appendChild(deleteButton);
    
        // Add the new history item to the list
        historyList.appendChild(newHistoryItem);
    
        return distance;
    }

    showTooltip(walk, color) {
        let tooltipContent;
    
        if (walk.podcastFetchAdress) {
            tooltipContent = `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <img src="${walk.podcastFetchAdress}" alt="${walk.podcastName} Logo" style="max-width: 50px; max-height: 50px; margin-bottom: 10px; object-fit: contain;">
                    <div style="font-weight: bold; color: ${color}; font-size: 14px; text-align: center;">${walk.podcastName}</div>
                </div>
            `;
        }
        else {
            tooltipContent = `
                <div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-weight: bold; color: ${color}; font-size: 14px; text-align: center;">${walk.podcastName}</div>
                </div>
            `;
        }

        walk.polyline.bindTooltip(tooltipContent, { permanent: false, sticky: true }).openTooltip();
    }

    showWalkOnMap(walk) {
        if (!Array.isArray(walk?.points) || walk.points.length === 0) {
            return;
        }

        const displayColor = this.getWalkColor(walk);

        walk.polyline = L.polyline(walk.points, { color: displayColor, weight: 4 }).addTo(this.map);
        this.visibleWalks.push(walk);

        walk.polyline.on('mouseover', () => {this.allowMarkerPlacement = false;});
        walk.polyline.on('mouseout', () => {this.allowMarkerPlacement = true;});
        
        walk.polyline.on('mouseover', () => {
            if (walk !== this.selectedWalk) {  // Only highlight if the polyline is not selected
                this.showTooltip(walk, displayColor);
                
    
                // Highlight the polyline (Change color to red on hover)
                walk.polyline.setStyle({
                    color: 'red',  // Change color to red on hover
                    weight: 6,     // Thicker line
                });
            }
        });


        walk.polyline.on('mouseout', () => {
            walk.polyline.closeTooltip(); // Close the tooltip

            if (walk !== this.selectedWalk) {
                walk.polyline.setStyle({
                    color: displayColor,  // Reset to original color
                    weight: 4,     // Reset to original weight
                });
            }
        });

        
        walk.polyline.on('click', () => {
            // Prevent the marker from being added (not using L.marker here)
            // If this polyline is already selected, we unselect it
            if (this.selectedWalk === walk) {
                this.deselectWalk(walk, displayColor);
            } else {
                // Deselect the previously selected polyline
                if (this.selectedWalk) {
                    this.deselectWalk(this.selectedWalk, this.getWalkColor(this.selectedWalk));
                }

                this.selectWalk(walk);
            }
        });
    }

    removeWalkFromMap(walk) {
        if (walk?.polyline && this.map.hasLayer(walk.polyline)) {
            this.map.removeLayer(walk.polyline);
        }
    }

    async createNewWalk(pointsInput) {
        let points = Array.isArray(pointsInput)
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
                color: '#000000',
                logoUrl: '',
            };

        const walkObj = {
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            podcastName,
            podcastIndex,
            podcast,
            podcastFetchAdress: podcast.logoUrl || await searchPodcast(podcastName),
            points: points,
            date: new Date().toISOString(),
            polyline: null
        };

        for (const marker of this.markers) {
            if (this.map.hasLayer(marker.marker)) {
                this.map.removeLayer(marker.marker);
            }
        }

        podcastNameInput.value = '';
        this.markers = [];
        this.sessionActions.push("created walk");

        return walkObj;
    }

    placeMarker(event) {
        if (this.allowMarkerPlacement && !this.isHoveringPolyline && !this.isPolylineSelected) {
            const latLng = event.latlng;
            const marker = L.marker(latLng).addTo(this.map);
            
            
            this.markers.push({marker: marker, latLng: latLng});
        }

        this.sessionActions.push("placed marker");
    }

    undo() {
        if (this.sessionActions.length <= 0) return;


        const lastAction = this.sessionActions[this.sessionActions.length-1];

        if (lastAction === "placed marker") {
            if (this.markers.length > 0) {
                let lastMarker = this.markers.pop(); // Remove last marker from array
                this.map.removeLayer(lastMarker.marker); // Remove marker from map
                this.sessionActions.pop();
            }
        }   
        else if (lastAction === "created walk"){
            if (confirm("Are you sure that want to remove a walk?")) {
                const walks = this.localStorageHandler.retrieveWalksFromLocalStorage();
                walks.pop();
                localStorage.setItem('walks', JSON.stringify(walks));
    
                this.showExistingWalks();
                this.sessionActions.pop();
            }
        }
    }

    selectWalk(walk) {
        // Select this polyline
        walk.polyline.setStyle({
            color: 'green',  // Set selected polyline to green
            weight: 6,       // Thicker line for selected
        });
        this.selectedWalk = walk;
    }

    deselectWalk(walk, color) {
        walk.polyline.setStyle({
            color: color,  // Reset to original color
            weight: 4,     // Reset to original weight
        });
        this.selectedWalk = null; // Unselect it
    }

    async createSaveShowWalk(points) {
        const newWalk = points !== undefined
            ? await this.createNewWalk(points)
            : await this.createNewWalk();

        if (!newWalk) {
            alert("Enter a podcast name and record at least one point before saving.");
            return false;
        }

        this.localStorageHandler.saveWalkToLocalStorage(newWalk);
        this.showExistingWalks();
        return true;
    }
}
