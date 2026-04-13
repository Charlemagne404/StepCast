const saveWalkButton = document.getElementById('save-walk');
const clearWalksButton = document.getElementById('clear-paths');
const undoButton = document.getElementById('undo-btn');
const saveGPSWalkButton = document.getElementById('save-gps-walk');
const guestButton = document.getElementById('guest-button');
const podcastNameInput = document.getElementById('podcast-input');
const overlay = document.getElementById('overlay');
const authPopup = document.getElementById('authPopup');
const logoutButton = document.getElementById('logoutButton');

const settingsButton = document.getElementById('settings-button');
const settingsPopup = document.getElementById('settings-popup');
const exitSettingsButton = document.getElementById('exit-settings-button');

import { podcastData } from "./data.js";
import { Map } from "./map.js";
import { LocalStorageHandler } from "./storageHandler.js";

const localStorageHandler = new LocalStorageHandler();
const testMap = new Map(localStorageHandler, podcastData);
const AUTH_STORAGE_KEY = 'authToken';
const DEFAULT_LOCAL_API_ORIGIN = 'http://127.0.0.1:5002';
let authToken = localStorage.getItem(AUTH_STORAGE_KEY) || '';
let walkMarkers = [];

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const readConfiguredApiBaseUrl = () => trimTrailingSlash(window.__STEPCAST_API_BASE_URL__);
const isGitHubPagesHost = () => window.location.hostname.endsWith('github.io');
const resolveApiBaseUrl = () => {
    const configured = readConfiguredApiBaseUrl();
    if (configured) {
        return configured;
    }

    if (window.location.protocol === 'file:') {
        return DEFAULT_LOCAL_API_ORIGIN;
    }

    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (isLocalhost && window.location.port !== '5002') {
        return `${window.location.protocol}//${window.location.hostname}:5002`;
    }

    if (isGitHubPagesHost()) {
        return '';
    }

    return trimTrailingSlash(window.location.origin);
};
const API_BASE_URL = resolveApiBaseUrl();
const API_CONFIGURATION_ERROR = 'StepCast API is not configured for this deployment. Set window.__STEPCAST_API_BASE_URL__ in config.js to your backend origin.';

testMap.showExistingWalks();

const getApiUrl = (path) => {
    if (!API_BASE_URL) {
        throw new Error(API_CONFIGURATION_ERROR);
    }

    return `${API_BASE_URL}${path}`;
};

const parseResponseBody = async (response) => {
    const text = await response.text();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
};

const setAuthToken = (token) => {
    authToken = String(token || '').trim();

    if (authToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, authToken);
        return;
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
};

const showLoggedInUi = () => {
    overlay.style.display = "none";
    authPopup.style.display = "none";
    logoutButton.style.display = "block";
};

const showLoggedOutUi = () => {
    overlay.style.display = "block";
    authPopup.style.display = "flex";
    logoutButton.style.display = "none";
};

const sendApiRequest = async (path, { method = 'GET', body, auth = true } = {}) => {
    const headers = {};

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(getApiUrl(path), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
    });

    const data = await parseResponseBody(response);
    return { response, data };
};

const refreshAuthSession = async () => {
    try {
        const { response, data } = await sendApiRequest('/api/auth/refresh_token', {
            method: 'POST',
            auth: false,
        });

        const nextToken = data.accessToken || data.token;
        if (response.ok && nextToken) {
            setAuthToken(nextToken);
            return true;
        }
    } catch (error) {
        console.error('Session refresh failed:', error);
    }

    setAuthToken('');
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
        const { response } = await sendApiRequest('/api/auth/me', {
            method: 'GET',
        });
        return response.ok;
    } catch (error) {
        console.error('Session verification failed:', error);
        return false;
    }
};

const restoreAuthSession = async () => {
    if (!API_BASE_URL) {
        setAuthToken('');
        showLoggedOutUi();
        return false;
    }

    if (await verifyCurrentSession()) {
        showLoggedInUi();
        return true;
    }

    setAuthToken('');

    if (await refreshAuthSession()) {
        showLoggedInUi();
        return true;
    }

    showLoggedOutUi();
    return false;
};


// *******
// Handling map events
// ******

testMap.map.on('mouseover', (event) => {
    testMap.cursorHoversMap = true;

    if (event.target instanceof L.Polyline || event.target instanceof L.Polygon) {
        testMap.isHoveringPolyline = true; // The mouse is over a polyline or polygon
    }
});

testMap.map.on('mouseout', (event) => {
    testMap.cursorHoversMap = false;

    if (event.target instanceof L.Polyline || event.target instanceof L.Polygon) {
        testMap.isHoveringPolyline = false; // The mouse is no longer over a polyline or polygon
    }
});

testMap.map.on('click', (event) => {
    testMap.cursorHoversMap = true;
    testMap.placeMarker(event);
});




// *******
// Handling walk events
// *******

saveWalkButton.addEventListener('click', (event) => {
    testMap.createSaveShowWalk();
});

clearWalksButton.addEventListener('click', (event) => {
    localStorageHandler.clearLocalStorage();
    testMap.showExistingWalks();
});

undoButton.addEventListener('click', () => {
    testMap.undo();
});



// *******
// Handling key events
// *******

document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') { 
        event.preventDefault(); // Prevents unintended browser shortcuts (e.g., undoing text input)
        testMap.undo();
    }

    if (event.key === 'Backspace' || event.key === 'Delete') { // Should only be selected
        if (testMap.selectedWalk !== null) {
            localStorageHandler.removeWalkFromLocalStorage(testMap.selectedWalk);
            testMap.showExistingWalks();
        }
    }

    if (event.key === 'Enter') {
        if (document.activeElement === podcastNameInput) {
            testMap.createSaveShowWalk();
        }
    }
});

document.addEventListener('click', (event) => {
    if (!testMap.cursorHoversMap) {
        if (testMap.selectedWalk) {
            testMap.deselectWalk(testMap.selectedWalk, testMap.getWalkColor(testMap.selectedWalk));
        }
    }
});


// *******
// Settings Events
// *******

settingsButton.onclick = function () {
    settingsPopup.style.display = 'flex';
}

exitSettingsButton.onclick = function () {
    settingsPopup.style.display =  'none';
}






// *******
// GPS Events
// *******

let tracking = false;
let watchID = null;
let gpsPath = []; // Temporary GPS path storage
let gpsPolyline = null;
let userMarker; // Store the user's location marker

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

        const { response, data } = await apiRequest('/api/location', {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(data.message || "Failed to fetch walk data");
        }

        clearWalkMarkers();

        // Display the walks on the map
        data.forEach(walk => {
            const marker = L.circle([walk.latitude, walk.longitude], {
                color: 'red',
                fillColor: '#ff6666',
                fillOpacity: 0.6,
                radius: 10
            }).addTo(testMap.map);

            walkMarkers.push(marker);
        });

    } catch (error) {
        console.error("Error fetching walk data:", error);
    }
};


// Function to create or update the user marker
const createUserMarker = (latlng) => {
    if (!userMarker) {
        userMarker = L.circle([latlng.lat, latlng.lng], {
            color: 'blue',
            fillColor: '#3388ff',
            fillOpacity: 0.6,
            radius: 20
        }).addTo(testMap.map);
    } else {
        userMarker.setLatLng([latlng.lat, latlng.lng]); // Update the marker location
    }
};

// Get the user's initial position for setting the marker and centering the map
if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
        let latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
        createUserMarker(latlng); // Create the marker initially
        testMap.map.setView(latlng, 15); // Optionally, adjust the map view to the user's location
    }, error => {
        console.error("Error getting initial location:", error);
    });
}

// Function to start/stop tracking
const toggleTracking = () => {
    if (tracking) {
        // Stop tracking
        if (watchID !== null) {
            navigator.geolocation.clearWatch(watchID);
            watchID = null; // Reset watchID
        }

        // Notify iOS to stop tracking if available
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.stopTracking) {
            window.webkit.messageHandlers.stopTracking.postMessage(null);
        }

        document.getElementById('toggleTracking').innerText = "Start Tracking";
        alert("Tracking stopped. Now enter the podcast name and save your walk.");
    } else {
        if (!('geolocation' in navigator) && !(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startTracking)) {
            alert("Geolocation is not supported on this device.");
            return;
        }

        // Start tracking
        gpsPath = []; // Clear previous path
        if (gpsPolyline) {
            testMap.map.removeLayer(gpsPolyline); // Remove the previous polyline
        }
        gpsPolyline = L.polyline([], { color: 'blue' }).addTo(testMap.map);

        // Check if iOS is available
        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.startTracking) {
            window.webkit.messageHandlers.startTracking.postMessage(null);
        } else {
            // If no iOS app, track using JS (for laptops or web-only use)
            watchID = navigator.geolocation.watchPosition(position => {
                let latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
                gpsPath.push({ latLng: latlng });
                gpsPolyline.addLatLng(latlng);
                testMap.map.setView(latlng, 15);

                createUserMarker(latlng);
            }, error => {
                console.error("Error getting location:", error);
            }, { enableHighAccuracy: true });

        }

        document.getElementById('toggleTracking').innerText = "Stop Tracking";
    }

    tracking = !tracking;
};




// Save walk data when the user clicks the "Save Walk" button
saveGPSWalkButton.addEventListener('click', async function() {
    // Ensure path only contains valid points
    let validPathHistory = gpsPath.filter(function(path) {
        return path.latLng && typeof path.latLng.lat === 'number' && typeof path.latLng.lng === 'number';
    });


    const didSave = await testMap.createSaveShowWalk(validPathHistory.map(path => path.latLng));
    if (!didSave) {
        return;
    }

    /*
    // Match podcast name with list (you need to implement podcastData)
    let podcastMatchIndex = podcastData.findIndex(p => p.name === podcastName);
    */

    /*
    // Save walk data
    var savedWalk = {
        podcastIndex: podcastMatchIndex,
        podcast: podcastName,
        points: validPathHistory.map(path => path.latLng),
        date: new Date().toISOString()
    };*/

    /*
    // Store in localStorage
    var storedHistory = JSON.parse(localStorage.getItem('walkHistory')) || [];
    storedHistory.push(savedWalk);
    localStorage.setItem('walkHistory', JSON.stringify(storedHistory));
    */

    // Reset everything for the next walk
    gpsPath = [];
    document.getElementById('podcast-input').value = ''; 

    /*
    // Update UI (implement these functions)
    addHistoryItem(savedWalk);         // Detta kommer inte längre att fungera
    addWalkToMap(savedWalk);
    */
});

// Attach event to tracking button
document.getElementById('toggleTracking').addEventListener('click', toggleTracking);


// *******
// UI stuff
// *******


// *******
// Login/Registration Events
// *******
guestButton.onclick = function () {
    overlay.style.display = "none"; // Hide the overlay
    authPopup.style.display = "none"; // Hide the popup
}

document.addEventListener("DOMContentLoaded", () => {

    // *******
    // Resizing Events
    // *******

    const gridContainer = document.querySelector(".wrapper");
    const scaler = document.getElementById("scaler");

    let isResizing = false;

    scaler.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.body.style.pointerEvents = "none";
        isResizing = true;
        document.addEventListener("mousemove", resize);
        document.addEventListener("mouseup", () => {
            isResizing = false;
            ;
            document.removeEventListener("mousemove", resize);
            testMap.map.invalidateSize();
            document.body.style.pointerEvents = "auto";
            
        });
    });

    function resize(e) {
        if (!isResizing) return;

        let gridRect = gridContainer.getBoundingClientRect();
        let minHeight = 5;  // Minimum size of resizable section
        let maxHeight = gridRect.height - 210; // Ensure lower section has space
        let newHeight = e.clientY - gridRect.top;

        if (newHeight < minHeight) newHeight = minHeight;
        if (newHeight > maxHeight) newHeight = maxHeight;

        gridContainer.style.gridTemplateRows = `${newHeight}px 5px 1fr`;

        // Force Leaflet to update
        setTimeout(() => testMap.map.invalidateSize(), 0);
    }


    // *******
    // Auth Events
    // *******

    const authForm = document.getElementById("authForm");
    const authTitle = document.getElementById("authTitle");
    const switchToRegisterLink = document.getElementById("switchToRegister");
    const switchToLoginLink = document.getElementById("switchToLogin");
    const toggleAuthText = document.getElementById("toggleAuth");
    const toggleAuthBackText = document.getElementById("toggleAuthBack");
    const darkModeToggle = document.getElementById("dark-mode-toggle");

    // Apply dark mode if previously set
    if (localStorage.getItem("theme") === "dark") {
        document.body.classList.add("dark-mode");
    }

    // Function to toggle dark mode
    function toggleDarkMode() {
        document.body.classList.toggle("dark-mode");
        if (document.body.classList.contains("dark-mode")) {
            localStorage.setItem("theme", "dark");
        } else {
            localStorage.setItem("theme", "light");
        }
    }

    // Dark mode toggle listener
    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", toggleDarkMode);
    }

    let isSignup = false;

    function updateAuthMode(signupMode) {
        isSignup = signupMode;
        authTitle.textContent = signupMode ? "Sign Up" : "Login";
        document.getElementById("authSubmit").textContent = signupMode ? "Sign Up" : "Login";
        toggleAuthText.style.display = signupMode ? "none" : "block";
        toggleAuthBackText.style.display = signupMode ? "block" : "none";
    }

    // Switch to register view
    switchToRegisterLink.addEventListener("click", (e) => {
        e.preventDefault();
        updateAuthMode(true);
    });

    // Switch to login view
    switchToLoginLink.addEventListener("click", (e) => {
        e.preventDefault();
        updateAuthMode(false);
    });

    // Form submission logic
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!API_BASE_URL) {
            alert(API_CONFIGURATION_ERROR);
            return;
        }

        const email = document.getElementById("authEmail").value;
        const password = document.getElementById("authPassword").value;

        const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';

        try {
            const { response, data } = await apiRequest(endpoint, {
                method: 'POST',
                auth: false,
                retryOn401: false,
                body: {
                    email: email,
                    password: password,
                },
            });

            if (!response.ok) {
                throw new Error(data.message || `${isSignup ? 'Sign-up' : 'Login'} failed`);
            }

            const nextToken = data.accessToken || data.token;
            if (nextToken) {
                setAuthToken(nextToken);
                showLoggedInUi();
                await fetchWalks();
                return;
            }

            alert(data.message || (isSignup
                ? 'Registration complete. Check your inbox to verify your Continental ID account before signing in.'
                : 'Continental ID did not return an active session.'));

            if (isSignup) {
                updateAuthMode(false);
            }
        } catch (error) {
            console.error(error);
            alert(error.message || `${isSignup ? 'Sign-up' : 'Login'} failed. Please check your credentials.`);
        }
    });

    logoutButton.addEventListener('click', async () => {
        try {
            await sendApiRequest('/api/auth/logout', {
                method: 'POST',
                auth: false,
            });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            setAuthToken('');
            clearWalkMarkers();
            showLoggedOutUi();
        }
    });

    restoreAuthSession().then((authenticated) => {
        if (authenticated) {
            fetchWalks();
        }
    });

    updateAuthMode(false);
});
