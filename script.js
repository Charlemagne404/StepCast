import { podcastData } from "./data.js";
import { Map } from "./map.js";
import { LocalStorageHandler } from "./storageHandler.js";

const saveWalkButton = document.getElementById("save-walk");
const clearWalksButton = document.getElementById("clear-paths");
const undoButton = document.getElementById("undo-btn");
const saveGPSWalkButton = document.getElementById("save-gps-walk");
const guestButton = document.getElementById("guest-button");
const podcastNameInput = document.getElementById("podcast-input");
const podcastSuggestions = document.getElementById("podcast-suggestions");
const overlay = document.getElementById("overlay");
const authPopup = document.getElementById("authPopup");
const logoutButton = document.getElementById("logoutButton");
const settingsButton = document.getElementById("settings-button");
const settingsPopup = document.getElementById("settings-popup");
const exitSettingsButton = document.getElementById("exit-settings-button");
const privacyPolicyButton = document.getElementById("privacy-policy-button");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authFeedback = document.getElementById("authFeedback");
const authStaticMessage = document.getElementById("authStaticMessage");
const switchToRegisterLink = document.getElementById("switchToRegister");
const switchToLoginLink = document.getElementById("switchToLogin");
const toggleAuthText = document.getElementById("toggleAuth");
const toggleAuthBackText = document.getElementById("toggleAuthBack");
const mapStatusPill = document.getElementById("map-status-pill");
const statusBanner = document.getElementById("status-banner");
const statusBannerTitle = document.getElementById("status-banner-title");
const statusBannerBody = document.getElementById("status-banner-body");
const authStatusLabel = document.getElementById("auth-status-label");
const totalWalksStat = document.getElementById("stat-total-walks");
const totalDistanceStat = document.getElementById("stat-total-distance");
const currentDraftStat = document.getElementById("stat-current-draft");
const lastSavedStat = document.getElementById("stat-last-saved");
const selectionState = document.getElementById("selection-state");
const trackingState = document.getElementById("tracking-state");
const draftPointCount = document.getElementById("draft-point-count");
const gpsPointCount = document.getElementById("gps-point-count");
const themeToggleButtons = Array.from(document.querySelectorAll("[data-theme-toggle]"));
const mapTypeButtons = Array.from(document.querySelectorAll("[data-map-type]"));

const localStorageHandler = new LocalStorageHandler();
const testMap = new Map(localStorageHandler, podcastData);
const AUTH_STORAGE_KEY = "authToken";
const DEFAULT_LOCAL_API_ORIGIN = "http://127.0.0.1:5002";

let authToken = localStorage.getItem(AUTH_STORAGE_KEY) || "";
let walkMarkers = [];
let tracking = false;
let watchID = null;
let gpsPath = [];
let gpsPolyline = null;
let userMarker;
let isSignup = false;
let guestMode = false;
let flashTimeout = null;
let statusFlashActive = false;

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");
const readConfiguredApiBaseUrl = () => trimTrailingSlash(window.__STEPCAST_API_BASE_URL__);
const isGitHubPagesHost = () => window.location.hostname.endsWith("github.io");
const resolveApiBaseUrl = () => {
    const configured = readConfiguredApiBaseUrl();
    if (configured) {
        return configured;
    }

    if (window.location.protocol === "file:") {
        return DEFAULT_LOCAL_API_ORIGIN;
    }

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (isLocalhost && window.location.port !== "5002") {
        return `${window.location.protocol}//${window.location.hostname}:5002`;
    }

    if (isGitHubPagesHost()) {
        return "";
    }

    return trimTrailingSlash(window.location.origin);
};

const API_BASE_URL = resolveApiBaseUrl();
const API_CONFIGURATION_ERROR = "StepCast API is not configured for this deployment. Set window.__STEPCAST_API_BASE_URL__ in config.js to your backend origin.";
let apiAvailable = Boolean(API_BASE_URL);

testMap.showExistingWalks();

const getApiUrl = (path) => {
    if (!API_BASE_URL) {
        throw new Error(API_CONFIGURATION_ERROR);
    }

    return `${API_BASE_URL}${path}`;
};

const parseResponseBody = async (response) => {
    const text = await response.text();
    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
};

const setAuthToken = (token) => {
    authToken = String(token || "").trim();

    if (authToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, authToken);
        return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
};

const markBackendUnavailable = () => {
    if (!API_BASE_URL || !apiAvailable) {
        return;
    }

    apiAvailable = false;
    setAuthToken("");
    configureAuthPopupAvailability();
    updateAuthStatusLabel();
};

const updateOverlayVisibility = () => {
    const shouldShowOverlay = settingsPopup.style.display === "flex" || authPopup.style.display === "flex";
    overlay.hidden = !shouldShowOverlay;
};

const updateThemeToggleLabels = () => {
    const isDarkMode = document.body.classList.contains("dark-mode");
    for (const button of themeToggleButtons) {
        const label = button.querySelector("[data-theme-label]");
        if (label) {
            label.textContent = isDarkMode ? "Light theme" : "Night theme";
        }
    }
};

const toggleDarkMode = () => {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }

    updateThemeToggleLabels();
};

const clearAuthFeedback = () => {
    authFeedback.hidden = true;
    authFeedback.textContent = "";
};

const setAuthFeedback = (message) => {
    authFeedback.hidden = false;
    authFeedback.textContent = message;
};

const updateAuthMode = (signupMode) => {
    isSignup = signupMode;
    authTitle.textContent = signupMode ? "Create Account" : "Login";
    document.getElementById("authSubmit").textContent = signupMode ? "Create account" : "Login";
    authDescription.textContent = signupMode
        ? "Create an account to keep your walks synced across devices when cloud access is enabled."
        : "Save walks across devices and pull synced route markers when cloud access is available.";
    toggleAuthText.style.display = signupMode ? "none" : "block";
    toggleAuthBackText.style.display = signupMode ? "block" : "none";
    clearAuthFeedback();
};

const updateAuthStatusLabel = () => {
    authStatusLabel.classList.toggle("connection-pill--active", Boolean(authToken));

    if (authToken) {
        authStatusLabel.textContent = "Cloud sync on";
        return;
    }

    if (!API_BASE_URL || !apiAvailable) {
        authStatusLabel.textContent = "Local-only build";
        return;
    }

    authStatusLabel.textContent = guestMode ? "Guest mode" : "Sign-in available";
};

const showLoggedInUi = () => {
    guestMode = false;
    clearAuthFeedback();
    overlay.hidden = settingsPopup.style.display !== "flex";
    authPopup.style.display = "none";
    logoutButton.style.display = "inline-flex";
    updateAuthStatusLabel();
    syncInterface();
};

const showLoggedOutUi = () => {
    guestMode = false;
    clearAuthFeedback();
    authPopup.style.display = "flex";
    logoutButton.style.display = "none";
    configureAuthPopupAvailability();
    updateOverlayVisibility();
    updateAuthStatusLabel();
};

const activateGuestMode = () => {
    guestMode = true;
    clearAuthFeedback();
    authPopup.style.display = "none";
    updateOverlayVisibility();
    updateAuthStatusLabel();
    flashStatus({
        title: "Guest mode active",
        body: apiAvailable
            ? "Walks will stay on this device until you sign in to a connected backend."
            : "Cloud sync is unavailable right now, so walks will stay on this device.",
        tone: "warning",
    });
};

const openSettings = () => {
    settingsPopup.style.display = "flex";
    updateOverlayVisibility();
};

const closeSettings = () => {
    settingsPopup.style.display = "none";
    updateOverlayVisibility();
};

const populatePodcastSuggestions = () => {
    const fragment = document.createDocumentFragment();

    for (const podcast of podcastData) {
        const option = document.createElement("option");
        option.value = podcast.name;
        fragment.appendChild(option);
    }

    podcastSuggestions.replaceChildren(fragment);
};

const calculateDistanceForPoints = (points = []) => {
    let distance = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        const pointA = L.latLng(points[index].lat, points[index].lng);
        const pointB = L.latLng(points[index + 1].lat, points[index + 1].lng);
        distance += pointA.distanceTo(pointB);
    }

    return distance;
};

const formatDistance = (meters) => `${(meters / 1000).toFixed(2)} km`;

const formatTimestamp = (value) => {
    if (!value) {
        return "Nothing yet";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
};

const applyStatus = ({ title, body, tone = "default" }) => {
    statusBanner.dataset.tone = tone;
    statusBannerTitle.textContent = title;
    statusBannerBody.textContent = body;
};

const getAmbientStatus = () => {
    if (tracking) {
        return {
            title: "Tracking live",
            body: `${gpsPath.length} GPS point${gpsPath.length === 1 ? "" : "s"} captured. Keep moving, then save the route when the walk is done.`,
            tone: "success",
        };
    }

    if (testMap.selectedWalk) {
        const selectedDistance = calculateDistanceForPoints(testMap.selectedWalk.points || []);
        return {
            title: `${testMap.selectedWalk.podcastName} selected`,
            body: `Focused on a saved route with ${formatDistance(selectedDistance)} logged. Click another route or empty space to change selection.`,
            tone: "default",
        };
    }

    if (gpsPath.length > 0) {
        return {
            title: "GPS route ready",
            body: `${gpsPath.length} recorded point${gpsPath.length === 1 ? "" : "s"} waiting to be saved. Add a podcast title if needed, then save the route.`,
            tone: "default",
        };
    }

    if (testMap.markers.length > 0) {
        return {
            title: "Manual route in progress",
            body: `${testMap.markers.length} draft pin${testMap.markers.length === 1 ? "" : "s"} placed. Keep shaping the route or save it to your library.`,
            tone: "default",
        };
    }

    return {
        title: "Ready to map",
        body: "Drop pins for a manual route or start GPS tracking for a live walk.",
        tone: "default",
    };
};

const renderAmbientStatus = () => {
    if (!statusFlashActive) {
        applyStatus(getAmbientStatus());
    }
};

const flashStatus = ({ title, body, tone = "default" }, duration = 3600) => {
    if (flashTimeout) {
        clearTimeout(flashTimeout);
    }

    statusFlashActive = true;
    applyStatus({ title, body, tone });

    flashTimeout = window.setTimeout(() => {
        statusFlashActive = false;
        renderAmbientStatus();
    }, duration);
};

const syncInterface = () => {
    const walks = localStorageHandler.retrieveWalksFromLocalStorage();
    const totalDistanceMeters = walks.reduce((sum, walk) => sum + calculateDistanceForPoints(walk.points || []), 0);
    const lastWalk = walks[walks.length - 1];
    const draftPointTotal = testMap.markers.length + gpsPath.length;
    const hasManualDraft = testMap.markers.length > 0;
    const hasGpsDraft = gpsPath.length > 0;

    totalWalksStat.textContent = String(walks.length);
    totalDistanceStat.textContent = formatDistance(totalDistanceMeters);
    currentDraftStat.textContent = `${draftPointTotal} point${draftPointTotal === 1 ? "" : "s"}`;
    lastSavedStat.textContent = lastWalk ? formatTimestamp(lastWalk.date) : "Nothing yet";
    selectionState.textContent = testMap.selectedWalk ? testMap.selectedWalk.podcastName : "No route selected";
    trackingState.textContent = tracking
        ? `Live (${gpsPath.length} points)`
        : hasGpsDraft
            ? `${gpsPath.length} points ready to save`
            : "GPS idle";
    draftPointCount.textContent = String(testMap.markers.length);
    gpsPointCount.textContent = String(gpsPath.length);

    if (tracking) {
        mapStatusPill.textContent = "Live GPS";
    } else if (hasGpsDraft) {
        mapStatusPill.textContent = "GPS draft";
    } else if (hasManualDraft) {
        mapStatusPill.textContent = "Manual draft";
    } else {
        mapStatusPill.textContent = "Ready to plot";
    }

    saveWalkButton.disabled = !(podcastNameInput.value.trim() && hasManualDraft);
    saveGPSWalkButton.disabled = !(podcastNameInput.value.trim() && hasGpsDraft);
    undoButton.disabled = testMap.sessionActions.length === 0;
    document.getElementById("toggleTracking").classList.toggle("is-active", tracking);
    document.getElementById("toggleTracking").textContent = tracking ? "Stop live tracking" : "Start live tracking";

    updateAuthStatusLabel();
    renderAmbientStatus();
};

const setActiveMapType = (mapType) => {
    for (const button of mapTypeButtons) {
        button.classList.toggle("is-active", button.dataset.mapType === mapType);
    }
};

const configureAuthPopupAvailability = () => {
    const localOnly = !API_BASE_URL || !apiAvailable;
    authPopup.classList.toggle("auth-modal--local-only", localOnly);
    authStaticMessage.hidden = !localOnly;
    toggleAuthText.hidden = localOnly;
    toggleAuthBackText.hidden = localOnly;

    if (localOnly) {
        authTitle.textContent = "Local Mode";
        authDescription.textContent = "Cloud sync is unavailable in this session. You can still map and save walks on this device.";
        authStaticMessage.textContent = "Cloud sync is unavailable right now. Continue in guest mode to keep saving walks locally.";
        clearAuthFeedback();
        return;
    }

    toggleAuthText.hidden = false;
    toggleAuthBackText.hidden = false;
    updateAuthMode(isSignup);
};

const clearWalkMarkers = () => {
    for (const marker of walkMarkers) {
        testMap.map.removeLayer(marker);
    }

    walkMarkers = [];
};

const fetchWalks = async () => {
    try {
        if (!API_BASE_URL || !authToken) {
            clearWalkMarkers();
            return;
        }

        const { response, data } = await apiRequest("/api/location", {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to fetch walk data");
        }

        clearWalkMarkers();

        data.forEach((walk) => {
            const marker = L.circle([walk.latitude, walk.longitude], {
                color: "#c44d17",
                fillColor: "#ea6c2f",
                fillOpacity: 0.4,
                radius: 10,
            }).addTo(testMap.map);

            walkMarkers.push(marker);
        });
    } catch (error) {
        console.error("Error fetching walk data:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        flashStatus({
            title: "Could not load synced walks",
            body: error.message || "Remote walk markers could not be loaded right now.",
            tone: "warning",
        });
    }
};

const sendApiRequest = async (path, { method = "GET", body, auth = true } = {}) => {
    const headers = {};

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    if (auth && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(getApiUrl(path), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "include",
    });

    const data = await parseResponseBody(response);
    return { response, data };
};

const refreshAuthSession = async () => {
    try {
        const { response, data } = await sendApiRequest("/api/auth/refresh_token", {
            method: "POST",
            auth: false,
        });

        const nextToken = data.accessToken || data.token;
        if (response.ok && nextToken) {
            setAuthToken(nextToken);
            return true;
        }
    } catch (error) {
        console.error("Session refresh failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
    }

    setAuthToken("");
    return false;
};

const apiRequest = async (path, options = {}) => {
    const { auth = true, retryOn401 = true } = options;
    const result = await sendApiRequest(path, options);

    if (result.response.status === 401 && auth && retryOn401) {
        const refreshed = await refreshAuthSession();
        if (refreshed) {
            return sendApiRequest(path, { ...options, retryOn401: false });
        }

        showLoggedOutUi();
    }

    return result;
};

const verifyCurrentSession = async () => {
    if (!authToken) {
        return false;
    }

    try {
        const { response } = await sendApiRequest("/api/auth/me", {
            method: "GET",
        });
        return response.ok;
    } catch (error) {
        console.error("Session verification failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        return false;
    }
};

const restoreAuthSession = async () => {
    configureAuthPopupAvailability();

    if (!API_BASE_URL || !apiAvailable) {
        setAuthToken("");
        showLoggedOutUi();
        syncInterface();
        return false;
    }

    if (await verifyCurrentSession()) {
        showLoggedInUi();
        return true;
    }

    setAuthToken("");

    if (await refreshAuthSession()) {
        showLoggedInUi();
        return true;
    }

    showLoggedOutUi();
    return false;
};

const clearTemporaryGpsRoute = () => {
    if (gpsPolyline) {
        testMap.map.removeLayer(gpsPolyline);
        gpsPolyline = null;
    }
};

const createUserMarker = (latlng) => {
    if (!userMarker) {
        userMarker = L.circle([latlng.lat, latlng.lng], {
            color: "#176b73",
            fillColor: "#5eb8c5",
            fillOpacity: 0.58,
            radius: 18,
        }).addTo(testMap.map);
    } else {
        userMarker.setLatLng([latlng.lat, latlng.lng]);
    }
};

const stopTracking = ({ announce = true } = {}) => {
    if (!tracking) {
        return;
    }

    if (watchID !== null) {
        navigator.geolocation.clearWatch(watchID);
        watchID = null;
    }

    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.stopTracking) {
        window.webkit.messageHandlers.stopTracking.postMessage(null);
    }

    tracking = false;
    syncInterface();

    if (announce) {
        flashStatus({
            title: gpsPath.length > 0 ? "Tracking stopped" : "Live tracking stopped",
            body: gpsPath.length > 0
                ? "Your recorded path is ready. Confirm the podcast title, then save the GPS route."
                : "No route points were recorded during this tracking session.",
            tone: gpsPath.length > 0 ? "success" : "warning",
        });
    }
};

const startTracking = () => {
    const hasBrowserGeolocation = "geolocation" in navigator;
    const hasNativeBridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startTracking;

    if (!hasBrowserGeolocation && !hasNativeBridge) {
        flashStatus({
            title: "Location unavailable",
            body: "This device does not expose geolocation, so live tracking cannot be started here.",
            tone: "danger",
        });
        return;
    }

    gpsPath = [];
    clearTemporaryGpsRoute();
    gpsPolyline = L.polyline([], {
        color: "#176b73",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
    }).addTo(testMap.map);

    if (hasNativeBridge) {
        window.webkit.messageHandlers.startTracking.postMessage(null);
    } else {
        watchID = navigator.geolocation.watchPosition((position) => {
            const latlng = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            gpsPath.push({ latLng: latlng });
            gpsPolyline.addLatLng(latlng);
            testMap.map.setView(latlng, 15);
            createUserMarker(latlng);
            syncInterface();
        }, (error) => {
            console.error("Error getting location:", error);
            stopTracking({ announce: false });
            flashStatus({
                title: "Tracking failed",
                body: error.message || "The browser could not keep reading your location.",
                tone: "danger",
            });
        }, { enableHighAccuracy: true });
    }

    tracking = true;
    syncInterface();
    flashStatus({
        title: "Tracking started",
        body: "StepCast is now recording your movement. Stop tracking when the walk is done, then save the route.",
        tone: "success",
    });
};

const toggleTracking = () => {
    if (tracking) {
        stopTracking();
        return;
    }

    startTracking();
};

if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
        const latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
        };
        createUserMarker(latlng);
        testMap.map.setView(latlng, 15);
    }, (error) => {
        console.warn("Initial location unavailable:", error);
    });
}

testMap.map.on("mouseover", (event) => {
    testMap.cursorHoversMap = true;

    if (event.target instanceof L.Polyline || event.target instanceof L.Polygon) {
        testMap.isHoveringPolyline = true;
    }
});

testMap.map.on("mouseout", (event) => {
    testMap.cursorHoversMap = false;

    if (event.target instanceof L.Polyline || event.target instanceof L.Polygon) {
        testMap.isHoveringPolyline = false;
    }
});

testMap.map.on("click", (event) => {
    testMap.cursorHoversMap = true;
    testMap.placeMarker(event);
});

saveWalkButton.addEventListener("click", async () => {
    await testMap.createSaveShowWalk();
    syncInterface();
});

saveGPSWalkButton.addEventListener("click", async () => {
    if (tracking) {
        stopTracking({ announce: false });
    }

    const validPathHistory = gpsPath.filter((path) => path.latLng && typeof path.latLng.lat === "number" && typeof path.latLng.lng === "number");
    const didSave = await testMap.createSaveShowWalk(validPathHistory.map((path) => path.latLng));

    if (!didSave) {
        syncInterface();
        return;
    }

    gpsPath = [];
    clearTemporaryGpsRoute();
    podcastNameInput.value = "";
    syncInterface();
});

clearWalksButton.addEventListener("click", () => {
    const savedWalks = localStorageHandler.retrieveWalksFromLocalStorage();
    if (savedWalks.length === 0) {
        flashStatus({
            title: "Nothing to clear",
            body: "Your local walk library is already empty.",
            tone: "warning",
        });
        return;
    }

    if (!window.confirm("Clear all saved walks from this device?")) {
        return;
    }

    localStorageHandler.clearLocalStorage();
    testMap.showExistingWalks();
    flashStatus({
        title: "Walk library cleared",
        body: "All saved local walks were removed from this device.",
        tone: "success",
    });
});

undoButton.addEventListener("click", () => {
    testMap.undo();
    syncInterface();
});

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        testMap.undo();
        syncInterface();
    }

    if ((event.key === "Backspace" || event.key === "Delete") && testMap.selectedWalk !== null) {
        const removedWalk = testMap.selectedWalk;
        localStorageHandler.removeWalkFromLocalStorage(removedWalk);
        testMap.showExistingWalks();
        flashStatus({
            title: "Walk deleted",
            body: `${removedWalk?.podcastName || "The selected route"} was removed from your library.`,
            tone: "warning",
        });
    }

    if (event.key === "Enter" && document.activeElement === podcastNameInput && !saveWalkButton.disabled) {
        testMap.createSaveShowWalk().then(() => syncInterface());
    }

    if (event.key === "Escape" && settingsPopup.style.display === "flex") {
        closeSettings();
    }
});

document.addEventListener("click", (event) => {
    const clickedHistoryItem = event.target.closest(".history-item");
    const clickedModal = event.target.closest(".modal");

    if (!testMap.cursorHoversMap && !clickedHistoryItem && !clickedModal && testMap.selectedWalk) {
        testMap.deselectWalk(testMap.selectedWalk, testMap.getWalkColor(testMap.selectedWalk));
    }
});

settingsButton.addEventListener("click", openSettings);
exitSettingsButton.addEventListener("click", closeSettings);
privacyPolicyButton.addEventListener("click", () => {
    window.location.href = "privacy-policy.html";
});

overlay.addEventListener("click", () => {
    if (settingsPopup.style.display === "flex") {
        closeSettings();
    }
});

guestButton.addEventListener("click", activateGuestMode);
document.getElementById("toggleTracking").addEventListener("click", toggleTracking);
podcastNameInput.addEventListener("input", syncInterface);

for (const button of themeToggleButtons) {
    button.addEventListener("click", toggleDarkMode);
}

for (const button of mapTypeButtons) {
    button.addEventListener("click", () => {
        const { mapType } = button.dataset;
        if (!mapType) {
            return;
        }

        testMap.changeMapType(mapType);
        setActiveMapType(mapType);
        flashStatus({
            title: `${button.textContent} map active`,
            body: "The map style was updated without affecting your saved routes.",
            tone: "default",
        });
    });
}

switchToRegisterLink.addEventListener("click", (event) => {
    event.preventDefault();
    updateAuthMode(true);
});

switchToLoginLink.addEventListener("click", (event) => {
    event.preventDefault();
    updateAuthMode(false);
});

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthFeedback();

    if (!API_BASE_URL) {
        setAuthFeedback(API_CONFIGURATION_ERROR);
        return;
    }

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const endpoint = isSignup ? "/api/auth/register" : "/api/auth/login";

    try {
        const { response, data } = await apiRequest(endpoint, {
            method: "POST",
            auth: false,
            retryOn401: false,
            body: { email, password },
        });

        if (!response.ok) {
            throw new Error(data.message || `${isSignup ? "Sign-up" : "Login"} failed`);
        }

        const nextToken = data.accessToken || data.token;
        if (nextToken) {
            setAuthToken(nextToken);
            authForm.reset();
            showLoggedInUi();
            await fetchWalks();
            flashStatus({
                title: "Signed in",
                body: "Cloud sync is enabled for this session.",
                tone: "success",
            });
            return;
        }

        if (isSignup) {
            updateAuthMode(false);
            setAuthFeedback(data.message || "Registration complete. Verify your email, then log in.");
            return;
        }

        throw new Error("Continental ID did not return an active session.");
    } catch (error) {
        console.error(error);
        if (error instanceof TypeError || String(error.message || "").includes("Failed to fetch")) {
            markBackendUnavailable();
            setAuthFeedback("Cloud sync is unavailable right now. Continue in guest mode to keep using local walks.");
            return;
        }
        setAuthFeedback(error.message || `${isSignup ? "Sign-up" : "Login"} failed. Please check your credentials.`);
    }
});

logoutButton.addEventListener("click", async () => {
    try {
        await sendApiRequest("/api/auth/logout", {
            method: "POST",
            auth: false,
        });
    } catch (error) {
        console.error("Logout failed:", error);
    } finally {
        setAuthToken("");
        clearWalkMarkers();
        showLoggedOutUi();
        flashStatus({
            title: "Signed out",
            body: "Cloud sync is off. You can continue locally or log back in.",
            tone: "warning",
        });
    }
});

window.addEventListener("stepcast:ui-updated", syncInterface);
window.addEventListener("stepcast:status", (event) => {
    const detail = event.detail || {};
    flashStatus({
        title: detail.title || "StepCast updated",
        body: detail.message || "The interface was refreshed.",
        tone: detail.tone || "default",
    });
});

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}

populatePodcastSuggestions();
updateThemeToggleLabels();
updateAuthMode(false);
configureAuthPopupAvailability();
setActiveMapType("open");
syncInterface();

restoreAuthSession().then((authenticated) => {
    if (authenticated) {
        fetchWalks();
    }
});
