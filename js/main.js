// js/main.js (路線二完成後的最終版本)

// !! 請確保這裡貼上的是您在 index.html 中使用的那把「前端」金鑰 !!
const FRONTEND_API_KEY = "AIzaSyD0jCir32RozFeByy9sj6lLN3pxYkfjHHU"; // <-- 請換成您真實的前端金鑰

// Global variables
let map;
let infoWindow;
let markers = [];
let searchAreaBtn;
let searchAreaCircle;
let typeFilter;
let openNowFilter;
const taipeiStation = { lat: 25.0479, lng: 121.5171 };

function getIconForPlace(place) {
    if (place.types.includes('restaurant')) return 'assets/restaurant.png';
    if (place.types.includes('cafe')) return 'assets/cafe.png';
    if (place.types.includes('park')) return 'assets/park.png';
    if (place.types.includes('tourist_attraction')) return 'assets/attraction.png';
    return 'assets/default.png';
}

function setupResponsiveControls() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    openBtn.addEventListener('click', () => {
        sidebar.classList.add('is-open');
    });

    closeBtn.addEventListener('click', () => {
        sidebar.classList.remove('is-open');
    });
}

function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: taipeiStation,
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
    });
    infoWindow = new google.maps.InfoWindow();
    searchAreaBtn = document.getElementById('search-this-area-btn');
    typeFilter = document.getElementById('type-filter');
    openNowFilter = document.getElementById('opennow-filter');
    
    typeFilter.addEventListener('change', () => performSearch(map.getCenter()));
    openNowFilter.addEventListener('change', () => performSearch(map.getCenter()));
    map.addListener('dragend', () => searchAreaBtn.classList.remove('d-none'));
    map.addListener('zoom_changed', () => searchAreaBtn.classList.remove('d-none'));
    searchAreaBtn.addEventListener('click', () => performSearch(map.getCenter()));

    setupResponsiveControls();
    setupAutocomplete();
    performSearch(map.getCenter());
}

function setupAutocomplete() {
    const input = document.getElementById("search-input");
    const autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ["geometry", "name"],
        types: ["(cities)", "(regions)"],
    });
    autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
            map.setCenter(place.geometry.location);
            map.setZoom(14);
            performSearch(place.geometry.location);
        } else {
            alert("找不到該地點的詳細資訊");
        }
    });
    document.getElementById('search-button').addEventListener('click', () => {
        if (input.value.trim() !== '') {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: input.value }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    map.setCenter(location); map.setZoom(14); performSearch(location);
                } else {
                    alert('地理編碼失敗，原因: ' + status);
                }
            });
        }
    });
}

function performSearch(location) {
    if (searchAreaBtn) { searchAreaBtn.classList.add('d-none'); }
    if (searchAreaCircle) { searchAreaCircle.setMap(null); }
    clearResults();
    showLoader(true);
    const lat = location.lat();
    const lng = location.lng();
    const type = typeFilter.value;
    const opennow = openNowFilter.checked;
    const apiUrl = `https://proxipicks-backend.onrender.com/api/places?lat=${lat}&lng=${lng}&type=${type}&opennow=${opennow}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            return response.json();
        })
        .then(filteredResults => {
            renderResults(filteredResults);
            showLoader(false);
            searchAreaCircle = new google.maps.Circle({ strokeColor: '#0d6efd', strokeOpacity: 0.8, strokeWeight: 2, fillColor: '#0d6efd', fillOpacity: 0.1, map, center: location, radius: 5000 });
        })
        .catch(error => {
            console.error('Error fetching data from backend:', error);
            showLoader(false);
            document.getElementById('results-list').innerHTML = `<div class="p-3 text-danger">無法載入資料，請稍後再試。</div>`;
        });
}

function renderResults(places) {
    if (places.length === 0) {
        document.getElementById('results-list').innerHTML = `<div class="p-3 text-muted">在此區域找不到符合條件的地點。</div>`;
        return;
    }
    places.forEach((place, index) => {
        const marker = createMarker(place, index);
        markers.push(marker);
        createResultCard(place, index);
    });
}

function createMarker(place, index) {
    const iconUrl = getIconForPlace(place);
    const marker = new google.maps.Marker({ map, position: place.geometry.location, title: place.name, animation: google.maps.Animation.DROP, icon: { url: iconUrl, scaledSize: new google.maps.Size(35, 35) } });
    marker.addListener("click", () => {
        const content = `<h5>${place.name}</h5><p><strong>評分:</strong> ${place.rating} ⭐ (${place.user_ratings_total.toLocaleString()} 則評論)</p><p>${place.formatted_address}</p><a href="${place.url}" target="_blank">在 Google 地圖上查看</a>`;
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
        highlightCard(index);
    });
    return marker;
}

function createResultCard(place, index) {
    const list = document.getElementById('results-list');
    const card = document.createElement('a');
    card.className = 'list-group-item list-group-item-action result-item';
    card.setAttribute('data-index', index);
    let photoUrl = 'https://via.placeholder.com/80';
    if (place.photos && place.photos.length > 0) {
        const photoReference = place.photos[0].photo_reference;
        photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photoreference=${photoReference}&key=${FRONTEND_API_KEY}`;
    }
    card.innerHTML = `<div class="d-flex w-100"><img src="${photoUrl}" class="me-3 rounded" alt="${place.name}" style="width: 80px; height: 80px; object-fit: cover;"><div class="flex-grow-1"><div class="d-flex w-100 justify-content-between"><h5 class="mb-1">${index + 1}. ${place.name}</h5><span class="badge rounded-pill rating-badge p-2">${place.rating} ⭐</span></div><p class="mb-1">${place.formatted_address}</p><small class="text-muted">${place.user_ratings_total.toLocaleString()} 則評論</small></div></div>`;
    card.addEventListener('click', () => {
        google.maps.event.trigger(markers[index], 'click');
        map.panTo(markers[index].getPosition());
        map.setZoom(15);
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('is-open')) {
            sidebar.classList.remove('is-open');
        }
    });
    list.appendChild(card);
}

function clearResults() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    document.getElementById('results-list').innerHTML = '';
}

function showLoader(isLoading) {
    document.getElementById('loader').classList.toggle('d-none', !isLoading);
}

function highlightCard(index) {
    document.querySelectorAll('.result-item').forEach(card => {
        card.classList.remove('active');
        if (parseInt(card.getAttribute('data-index')) === index) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}