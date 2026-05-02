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
const settingsRouteCount = document.getElementById("settings-route-count");
const settingsDistanceTotal = document.getElementById("settings-distance-total");
const settingsSyncState = document.getElementById("settings-sync-state");
const settingsAccountStatus = document.getElementById("settings-account-status");
const settingsSyncButton = document.getElementById("settings-sync-button");
const settingsConnectButton = document.getElementById("settings-connect-button");
const exportWalksButton = document.getElementById("export-walks-button");
const importWalksButton = document.getElementById("import-walks-button");
const importWalksInput = document.getElementById("import-walks-input");
const resetCookiesButton = document.getElementById("reset-cookies-button");
const reducedMotionToggle = document.getElementById("reduced-motion-toggle");
const authTitle = document.getElementById("authTitle");
const authDescription = document.getElementById("authDescription");
const authFeedback = document.getElementById("authFeedback");
const authStaticMessage = document.getElementById("authStaticMessage");
const continentalLoginButton = document.getElementById("continental-login-button");
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
const themeChoiceButtons = Array.from(document.querySelectorAll("[data-theme-choice]"));
const mapTypeButtons = Array.from(document.querySelectorAll("[data-map-type]"));
const settingsMapTypeButtons = Array.from(document.querySelectorAll("[data-settings-map-type]"));
const distanceUnitButtons = Array.from(document.querySelectorAll("[data-distance-unit]"));
const mapOptionsMenu = document.querySelector(".map-options-menu");

const localStorageHandler = new LocalStorageHandler();
const testMap = new Map(localStorageHandler, podcastData);
const AUTH_STORAGE_KEY = "authToken";
const MAP_TYPE_STORAGE_KEY = "stepcast:mapType";
const DISTANCE_UNIT_STORAGE_KEY = "stepcast:distanceUnit";
const REDUCED_MOTION_STORAGE_KEY = "stepcast:reducedMotion";
const DEFAULT_LOCAL_API_ORIGIN = "http://127.0.0.1:5002";
const DEFAULT_CONTINENTAL_LOGIN_URL = "https://login.continental-hub.com/popup.html";
const DEFAULT_CONTINENTAL_AUTH_API_BASE_URL = "https://auth.continental-hub.com";

let authToken = localStorage.getItem(AUTH_STORAGE_KEY) || "";
let currentMapType = testMap.mapTypes[localStorage.getItem(MAP_TYPE_STORAGE_KEY)]
    ? localStorage.getItem(MAP_TYPE_STORAGE_KEY)
    : "open";
let currentDistanceUnit = localStorage.getItem(DISTANCE_UNIT_STORAGE_KEY) === "imperial" ? "imperial" : "metric";
let tracking = false;
let watchID = null;
let gpsPath = [];
let gpsPolyline = null;
let userMarker;
let guestMode = false;
let flashTimeout = null;
let statusFlashActive = false;
let loginPopupWindow = null;

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
const CONTINENTAL_LOGIN_URL = trimTrailingSlash(window.__CONTINENTAL_LOGIN_URL__ || DEFAULT_CONTINENTAL_LOGIN_URL);
const CONTINENTAL_AUTH_API_BASE_URL = trimTrailingSlash(window.__CONTINENTAL_AUTH_API_BASE_URL__ || DEFAULT_CONTINENTAL_AUTH_API_BASE_URL);
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

const updateSettingsControlState = () => {
    const isDarkMode = document.body.classList.contains("dark-mode");

    for (const button of themeChoiceButtons) {
        button.classList.toggle("is-active", button.dataset.themeChoice === (isDarkMode ? "dark" : "light"));
    }

    for (const button of settingsMapTypeButtons) {
        button.classList.toggle("is-active", button.dataset.settingsMapType === currentMapType);
    }

    for (const button of distanceUnitButtons) {
        button.classList.toggle("is-active", button.dataset.distanceUnit === currentDistanceUnit);
    }

    if (reducedMotionToggle) {
        reducedMotionToggle.checked = document.body.classList.contains("reduce-motion");
    }
};

const updateThemeToggleLabels = () => {
    const isDarkMode = document.body.classList.contains("dark-mode");
    for (const button of themeToggleButtons) {
        const label = button.querySelector("[data-theme-label]");
        if (label) {
            label.textContent = isDarkMode ? "Light theme" : "Night theme";
        }
    }

    updateSettingsControlState();
};

const applyThemePreference = (theme) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark-mode", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
    updateThemeToggleLabels();
};

const toggleDarkMode = () => {
    applyThemePreference(document.body.classList.contains("dark-mode") ? "light" : "dark");
};

const applyReducedMotionPreference = (isEnabled) => {
    document.body.classList.toggle("reduce-motion", Boolean(isEnabled));
    localStorage.setItem(REDUCED_MOTION_STORAGE_KEY, isEnabled ? "true" : "false");
    updateSettingsControlState();
};

const clearAuthFeedback = () => {
    authFeedback.hidden = true;
    authFeedback.textContent = "";
};

const setAuthFeedback = (message) => {
    authFeedback.hidden = false;
    authFeedback.textContent = message;
};

const updateAuthMode = () => {
    authTitle.textContent = "Sign in with Continental ID";
    authDescription.textContent = "Use Continental ID to sync complete StepCast routes across devices.";
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

const getSyncStatusText = () => {
    if (authToken) {
        return "Cloud";
    }

    if (!API_BASE_URL || !apiAvailable) {
        return "Local-only";
    }

    return guestMode ? "Guest" : "Available";
};

const updateSettingsSummary = () => {
    const walks = localStorageHandler.retrieveWalksFromLocalStorage();
    const totalDistanceMeters = walks.reduce((sum, walk) => sum + calculateDistanceForPoints(walk.points || []), 0);
    const syncStatus = getSyncStatusText();

    settingsRouteCount.textContent = String(walks.length);
    settingsDistanceTotal.textContent = formatDistance(totalDistanceMeters);
    settingsSyncState.textContent = syncStatus;

    if (authToken) {
        settingsAccountStatus.textContent = "Cloud sync is connected. Local changes can be synced to your account.";
    } else if (!API_BASE_URL || !apiAvailable) {
        settingsAccountStatus.textContent = "Cloud sync is unavailable in this build. Walks stay on this device.";
    } else {
        settingsAccountStatus.textContent = guestMode
            ? "Guest mode is active. Sign in to sync routes across devices."
            : "Sign in to sync complete routes across devices.";
    }

    settingsSyncButton.disabled = !authToken || !API_BASE_URL || !apiAvailable;
    settingsConnectButton.hidden = Boolean(authToken) || !API_BASE_URL || !apiAvailable;
    updateSettingsControlState();
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
    updateSettingsSummary();
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

const formatDistance = (meters) => {
    if (currentDistanceUnit === "imperial") {
        return `${(meters / 1609.344).toFixed(2)} mi`;
    }

    return `${(meters / 1000).toFixed(2)} km`;
};

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

const setStatusBannerVisibility = (isVisible) => {
    statusBanner.hidden = !isVisible;
};

const applyStatus = ({ title, body, tone = "default" }) => {
    statusBanner.dataset.tone = tone;
    statusBannerTitle.textContent = title;
    statusBannerBody.textContent = body;
    setStatusBannerVisibility(true);
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
    if (statusFlashActive) {
        return;
    }

    if (tracking) {
        applyStatus(getAmbientStatus());
        return;
    }

    setStatusBannerVisibility(false);
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
    updateSettingsSummary();
    renderAmbientStatus();
};

const setActiveMapType = (mapType) => {
    for (const button of mapTypeButtons) {
        button.classList.toggle("is-active", button.dataset.mapType === mapType);
    }

    for (const button of settingsMapTypeButtons) {
        button.classList.toggle("is-active", button.dataset.settingsMapType === mapType);
    }
};

const getMapTypeLabel = (mapType) => {
    const matchingButton = [...mapTypeButtons, ...settingsMapTypeButtons]
        .find((button) => button.dataset.mapType === mapType || button.dataset.settingsMapType === mapType);
    return matchingButton?.textContent?.trim() || "Selected";
};

const applyMapType = (mapType, { announce = false, closeOptions = false } = {}) => {
    if (!testMap.mapTypes[mapType]) {
        return;
    }

    currentMapType = mapType;
    localStorage.setItem(MAP_TYPE_STORAGE_KEY, mapType);
    testMap.changeMapType(mapType);
    setActiveMapType(mapType);
    updateSettingsControlState();

    if (closeOptions && mapOptionsMenu) {
        mapOptionsMenu.open = false;
    }

    if (announce) {
        flashStatus({
            title: `${getMapTypeLabel(mapType)} map active`,
            body: "The map style was saved as your default without affecting routes.",
            tone: "default",
        });
    }
};

const applyDistanceUnit = (unit) => {
    currentDistanceUnit = unit === "imperial" ? "imperial" : "metric";
    localStorage.setItem(DISTANCE_UNIT_STORAGE_KEY, currentDistanceUnit);
    testMap.showExistingWalks();
    syncInterface();
    flashStatus({
        title: currentDistanceUnit === "imperial" ? "Miles enabled" : "Kilometers enabled",
        body: "Distances in stats and saved walks now use your selected unit.",
        tone: "default",
    });
};

const exportWalkLibrary = () => {
    const walks = localStorageHandler.retrieveWalksFromLocalStorage();
    const payload = {
        app: "StepCast",
        exportedAt: new Date().toISOString(),
        walks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = objectUrl;
    downloadLink.download = `stepcast-walks-${new Date().toISOString().slice(0, 10)}.json`;
    downloadLink.click();
    URL.revokeObjectURL(objectUrl);

    flashStatus({
        title: "Library exported",
        body: `${walks.length} route${walks.length === 1 ? "" : "s"} prepared as a JSON backup.`,
        tone: "success",
    });
};

const importWalkLibrary = async (file) => {
    if (!file) {
        return;
    }

    try {
        const payload = JSON.parse(await file.text());
        const importedWalks = Array.isArray(payload) ? payload : payload.walks;

        if (!Array.isArray(importedWalks)) {
            throw new Error("Choose a StepCast JSON export or an array of walks.");
        }

        const beforeCount = localStorageHandler.retrieveWalksFromLocalStorage().length;
        localStorageHandler.mergeWalksIntoLocalStorage(importedWalks);
        const afterCount = localStorageHandler.retrieveWalksFromLocalStorage().length;
        testMap.showExistingWalks();
        syncInterface();

        flashStatus({
            title: "Library imported",
            body: `${Math.max(afterCount - beforeCount, 0)} new route${afterCount - beforeCount === 1 ? "" : "s"} added or updated locally.`,
            tone: "success",
        });
    } catch (error) {
        console.error("Library import failed:", error);
        flashStatus({
            title: "Import failed",
            body: error.message || "StepCast could not read that library file.",
            tone: "danger",
        });
    } finally {
        importWalksInput.value = "";
    }
};

const resetCookieChoice = () => {
    localStorage.removeItem("cookiesAccepted");
    const cookiePopup = document.getElementById("cookie-popup");
    if (cookiePopup) {
        cookiePopup.style.display = "block";
    }

    flashStatus({
        title: "Cookie choice reset",
        body: "The cookie notice will appear again so you can review it.",
        tone: "default",
    });
};

const openAuthFromSettings = () => {
    closeSettings();
    configureAuthPopupAvailability();
    authPopup.style.display = "flex";
    updateOverlayVisibility();
};

const configureAuthPopupAvailability = () => {
    const localOnly = !API_BASE_URL || !apiAvailable;
    authPopup.classList.toggle("auth-modal--local-only", localOnly);
    authStaticMessage.hidden = !localOnly;
    continentalLoginButton.disabled = localOnly;

    if (localOnly) {
        authTitle.textContent = "Local Mode";
        authDescription.textContent = "Cloud sync is unavailable in this session. You can still map and save walks on this device.";
        authStaticMessage.textContent = "Cloud sync is unavailable right now. Continue in guest mode to keep saving walks locally.";
        clearAuthFeedback();
        return;
    }

    updateAuthMode();
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

const sendContinentalAuthRequest = async (path, { method = "GET", body } = {}) => {
    const headers = {};

    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${CONTINENTAL_AUTH_API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "include",
    });

    const data = await parseResponseBody(response);
    return { response, data };
};

const refreshAuthSession = async () => {
    const refreshRequests = [
        () => sendContinentalAuthRequest("/api/auth/refresh_token", { method: "POST" }),
        () => sendApiRequest("/api/auth/refresh_token", { method: "POST", auth: false }),
    ];

    for (const [requestIndex, requestRefresh] of refreshRequests.entries()) {
        try {
            const { response, data } = await requestRefresh();
            const nextToken = data.accessToken || data.token;
            if (response.ok && nextToken) {
                setAuthToken(nextToken);
                return true;
            }
        } catch (error) {
            console.warn("Session refresh failed:", error);
            if (requestIndex > 0 && error instanceof TypeError) {
                markBackendUnavailable();
            }
        }
    }

    setAuthToken("");
    return false;
};

const logoutContinentalSession = async () => {
    try {
        await sendContinentalAuthRequest("/api/auth/logout", {
            method: "POST",
        });
    } catch (error) {
        console.error("Continental logout failed:", error);
    }

    try {
        await sendApiRequest("/api/auth/logout", {
            method: "POST",
            auth: false,
        });
    } catch (error) {
        console.error("StepCast auth proxy logout failed:", error);
    }
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

const syncWalkToCloud = async (walk, { silent = false } = {}) => {
    if (!walk || !API_BASE_URL || !apiAvailable || !authToken) {
        return false;
    }

    try {
        const { response, data } = await apiRequest("/api/location", {
            method: "POST",
            body: localStorageHandler.sanitizeWalk(walk),
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to sync walk.");
        }

        return true;
    } catch (error) {
        console.error("Cloud walk sync failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        if (!silent) {
            flashStatus({
                title: "Cloud sync failed",
                body: error.message || "The walk was saved locally but could not be synced yet.",
                tone: "warning",
            });
        }
        return false;
    }
};

const deleteWalkFromCloud = async (walk, { silent = false } = {}) => {
    const walkId = String(walk?.id || walk?.clientId || "").trim();
    if (!walkId || !API_BASE_URL || !apiAvailable || !authToken) {
        return false;
    }

    try {
        const { response, data } = await apiRequest(`/api/location/${encodeURIComponent(walkId)}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to delete synced walk.");
        }

        return true;
    } catch (error) {
        console.error("Cloud walk delete failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        if (!silent) {
            flashStatus({
                title: "Cloud delete failed",
                body: error.message || "The walk was removed locally but could not be removed from cloud sync.",
                tone: "warning",
            });
        }
        return false;
    }
};

const clearCloudWalks = async ({ silent = false } = {}) => {
    if (!API_BASE_URL || !apiAvailable || !authToken) {
        return false;
    }

    try {
        const { response, data } = await apiRequest("/api/location", {
            method: "DELETE",
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to clear synced walks.");
        }

        return true;
    } catch (error) {
        console.error("Cloud library clear failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        if (!silent) {
            flashStatus({
                title: "Cloud clear failed",
                body: error.message || "Local walks were cleared but the synced library could not be cleared.",
                tone: "warning",
            });
        }
        return false;
    }
};

const synchronizeCloudWalks = async ({ announce = false } = {}) => {
    if (!API_BASE_URL || !apiAvailable || !authToken) {
        return false;
    }

    try {
        for (const walk of localStorageHandler.retrieveWalksFromLocalStorage()) {
            await syncWalkToCloud(walk, { silent: true });
        }

        const { response, data } = await apiRequest("/api/location", {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to load synced walks.");
        }

        const remoteWalks = Array.isArray(data) ? data : [];
        localStorageHandler.mergeWalksIntoLocalStorage(remoteWalks);
        testMap.showExistingWalks();
        syncInterface();

        if (announce) {
            flashStatus({
                title: "Cloud sync complete",
                body: `${remoteWalks.length} synced route${remoteWalks.length === 1 ? "" : "s"} checked against this device.`,
                tone: "success",
            });
        }

        return true;
    } catch (error) {
        console.error("Cloud sync failed:", error);
        if (error instanceof TypeError) {
            markBackendUnavailable();
        }
        flashStatus({
            title: "Could not sync walks",
            body: error.message || "Remote walks could not be loaded right now.",
            tone: "warning",
        });
        return false;
    }
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

const buildContinentalLoginUrl = () => {
    const loginUrl = new URL(CONTINENTAL_LOGIN_URL, window.location.href);
    loginUrl.searchParams.set("origin", window.location.origin);
    loginUrl.searchParams.set("redirect", window.location.href);
    loginUrl.searchParams.set("apiBaseUrl", CONTINENTAL_AUTH_API_BASE_URL);
    return loginUrl;
};

const getContinentalLoginOrigin = () => {
    try {
        return new URL(CONTINENTAL_LOGIN_URL, window.location.href).origin;
    } catch {
        return "";
    }
};

const getTrustedContinentalMessageOrigins = () => {
    const origins = new Set();
    const loginOrigin = getContinentalLoginOrigin();
    if (loginOrigin) {
        origins.add(loginOrigin);
    }

    try {
        origins.add(new URL(CONTINENTAL_AUTH_API_BASE_URL).origin);
    } catch {
        // Ignore invalid optional auth API configuration.
    }

    return origins;
};

const openContinentalLogin = () => {
    if (!API_BASE_URL || !apiAvailable) {
        setAuthFeedback(API_CONFIGURATION_ERROR);
        return;
    }

    clearAuthFeedback();
    const loginUrl = buildContinentalLoginUrl();
    loginPopupWindow = window.open(
        loginUrl.toString(),
        "stepcast-continental-id",
        "popup,width=520,height=760",
    );

    if (!loginPopupWindow) {
        window.location.href = loginUrl.toString();
        return;
    }

    loginPopupWindow.focus();
    setAuthFeedback("Complete sign-in in the Continental ID window. StepCast will continue automatically.");
};

const handleContinentalLoginMessage = async (event) => {
    if (!getTrustedContinentalMessageOrigins().has(event.origin)) {
        return;
    }

    const payload = event.data || {};
    if (payload.type !== "LOGIN_SUCCESS") {
        return;
    }

    const nextToken = payload.accessToken || payload.token;
    if (!nextToken) {
        setAuthFeedback("Continental ID did not return an active session.");
        return;
    }

    setAuthToken(nextToken);
    loginPopupWindow = null;
    showLoggedInUi();
    await synchronizeCloudWalks({ announce: true });
    flashStatus({
        title: "Signed in",
        body: "Continental ID is connected and route sync is active.",
        tone: "success",
    });
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
    const savedWalk = await testMap.createSaveShowWalk();
    await syncWalkToCloud(savedWalk);
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

    await syncWalkToCloud(didSave);

    gpsPath = [];
    clearTemporaryGpsRoute();
    podcastNameInput.value = "";
    syncInterface();
});

clearWalksButton.addEventListener("click", async () => {
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

    const clearCloud = Boolean(authToken);
    localStorageHandler.clearLocalStorage();
    testMap.showExistingWalks();
    if (clearCloud) {
        await clearCloudWalks();
    }
    flashStatus({
        title: "Walk library cleared",
        body: clearCloud
            ? "All saved walks were removed from this device and cloud sync."
            : "All saved local walks were removed from this device.",
        tone: "success",
    });
});

undoButton.addEventListener("click", async () => {
    const previousWalkIds = new Set(localStorageHandler.retrieveWalksFromLocalStorage().map((walk) => walk.id));
    testMap.undo();
    const nextWalkIds = new Set(localStorageHandler.retrieveWalksFromLocalStorage().map((walk) => walk.id));
    for (const removedWalkId of previousWalkIds) {
        if (!nextWalkIds.has(removedWalkId)) {
            await deleteWalkFromCloud({ id: removedWalkId }, { silent: true });
        }
    }
    syncInterface();
});

document.addEventListener("keydown", async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        const previousWalkIds = new Set(localStorageHandler.retrieveWalksFromLocalStorage().map((walk) => walk.id));
        testMap.undo();
        const nextWalkIds = new Set(localStorageHandler.retrieveWalksFromLocalStorage().map((walk) => walk.id));
        for (const removedWalkId of previousWalkIds) {
            if (!nextWalkIds.has(removedWalkId)) {
                await deleteWalkFromCloud({ id: removedWalkId }, { silent: true });
            }
        }
        syncInterface();
    }

    if ((event.key === "Backspace" || event.key === "Delete") && testMap.selectedWalk !== null) {
        const removedWalk = testMap.selectedWalk;
        localStorageHandler.removeWalkFromLocalStorage(removedWalk);
        testMap.showExistingWalks();
        await deleteWalkFromCloud(removedWalk);
        flashStatus({
            title: "Walk deleted",
            body: `${removedWalk?.podcastName || "The selected route"} was removed from your library.`,
            tone: "warning",
        });
    }

    if (event.key === "Enter" && document.activeElement === podcastNameInput && !saveWalkButton.disabled) {
        const savedWalk = await testMap.createSaveShowWalk();
        await syncWalkToCloud(savedWalk);
        syncInterface();
    }

    if (event.key === "Escape" && settingsPopup.style.display === "flex") {
        closeSettings();
    }
});

document.addEventListener("click", (event) => {
    const clickedHistoryItem = event.target.closest(".history-item");
    const clickedModal = event.target.closest(".modal");
    const clickedMapOptionsMenu = event.target.closest(".map-options-menu");

    if (!testMap.cursorHoversMap && !clickedHistoryItem && !clickedModal && testMap.selectedWalk) {
        testMap.deselectWalk(testMap.selectedWalk, testMap.getWalkColor(testMap.selectedWalk));
    }

    if (mapOptionsMenu && !clickedMapOptionsMenu) {
        mapOptionsMenu.open = false;
    }
});

settingsButton.addEventListener("click", openSettings);
exitSettingsButton.addEventListener("click", closeSettings);
privacyPolicyButton.addEventListener("click", () => {
    window.location.href = "privacy-policy.html";
});
settingsSyncButton.addEventListener("click", () => synchronizeCloudWalks({ announce: true }));
settingsConnectButton.addEventListener("click", openAuthFromSettings);
exportWalksButton.addEventListener("click", exportWalkLibrary);
importWalksButton.addEventListener("click", () => importWalksInput.click());
importWalksInput.addEventListener("change", () => importWalkLibrary(importWalksInput.files?.[0]));
resetCookiesButton.addEventListener("click", resetCookieChoice);
reducedMotionToggle.addEventListener("change", () => applyReducedMotionPreference(reducedMotionToggle.checked));

overlay.addEventListener("click", () => {
    if (settingsPopup.style.display === "flex") {
        closeSettings();
    }
});

guestButton.addEventListener("click", activateGuestMode);
continentalLoginButton.addEventListener("click", openContinentalLogin);
document.getElementById("toggleTracking").addEventListener("click", toggleTracking);
podcastNameInput.addEventListener("input", syncInterface);

for (const button of themeToggleButtons) {
    button.addEventListener("click", toggleDarkMode);
}

for (const button of themeChoiceButtons) {
    button.addEventListener("click", () => {
        applyThemePreference(button.dataset.themeChoice);
    });
}

for (const button of mapTypeButtons) {
    button.addEventListener("click", () => {
        const { mapType } = button.dataset;
        applyMapType(mapType, { announce: true, closeOptions: true });
    });
}

for (const button of settingsMapTypeButtons) {
    button.addEventListener("click", () => {
        applyMapType(button.dataset.settingsMapType, { announce: true });
    });
}

for (const button of distanceUnitButtons) {
    button.addEventListener("click", () => {
        applyDistanceUnit(button.dataset.distanceUnit);
    });
}

logoutButton.addEventListener("click", async () => {
    try {
        await logoutContinentalSession();
    } catch (error) {
        console.error("Logout failed:", error);
    } finally {
        setAuthToken("");
        showLoggedOutUi();
        flashStatus({
            title: "Signed out",
            body: "Cloud sync is off. You can continue locally or log back in.",
            tone: "warning",
        });
    }
});

window.addEventListener("stepcast:ui-updated", syncInterface);
window.addEventListener("stepcast:walk-deleted", (event) => {
    deleteWalkFromCloud(event.detail?.walk);
});
window.addEventListener("stepcast:status", (event) => {
    const detail = event.detail || {};
    flashStatus({
        title: detail.title || "StepCast updated",
        body: detail.message || "The interface was refreshed.",
        tone: detail.tone || "default",
    });
});
window.addEventListener("message", handleContinentalLoginMessage);

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
}

applyReducedMotionPreference(localStorage.getItem(REDUCED_MOTION_STORAGE_KEY) === "true");
populatePodcastSuggestions();
updateThemeToggleLabels();
updateAuthMode();
configureAuthPopupAvailability();
applyMapType(currentMapType);
syncInterface();

restoreAuthSession().then((authenticated) => {
    if (authenticated) {
        synchronizeCloudWalks();
    }
});
