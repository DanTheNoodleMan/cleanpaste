document.addEventListener('DOMContentLoaded', function () {
	// Get UI elements
	const trackingCountEl = document.getElementById('tracking-count');
	const notificationsToggle = document.getElementById('notifications');
	const cleanDefaultToggle = document.getElementById('clean-default');
	const paramListEl = document.getElementById('param-list');
	const newParamInput = document.getElementById('new-param');
	const addParamBtn = document.getElementById('add-param-btn');

	loadUserPreferences();
	loadTrackingParams();

	notificationsToggle.addEventListener('change', function () {
		saveUserPreferences();
	});

	cleanDefaultToggle.addEventListener('change', function () {
		saveUserPreferences();
	});

	// Add new params event listener
	addParamBtn.addEventListener('click', addNewParam);
	newParamInput.addEventListener('keypress', function (e) {
		if (e.key === 'Enter') {
			addNewParam();
		}
	});

	// --- Functions to interact with storage --- //
	function loadUserPreferences() {
		chrome.storage.local.get(['userPreferences'], function (result) {
			const prefs = result.userPreferences || {};

			// Update UI based on stored preferences
			notificationsToggle.checked = prefs.showNotifications !== false;
			cleanDefaultToggle.checked = prefs.cleanByDefault === true;
			trackingCountEl.textContent = prefs.trackingRemoved || 0;
		});

		// Request latest stats from background
		chrome.runtime.sendMessage({ action: 'getStats' }, function (response) {
			if (response && response.stats) {
				trackingCountEl.textContent = response.stats.trackingRemoved || 0;
			}
		});
	}

	function saveUserPreferences() {
		const prefs = {
			showNotifications: notificationsToggle.checked,
			cleanByDefault: cleanDefaultToggle.checked,
			// Preserve existing tracking count
			trackingRemoved: parseInt(trackingCountEl.textContent) || 0,
		};

		chrome.storage.local.set({ userPreferences: prefs });
	}

	function loadTrackingParams() {
		chrome.storage.local.get(['trackingParams'], function (result) {
			const params = result.trackingParams || [];

			// Clear existing list
			paramListEl.innerHTML = '';

			// Add each parameter to the list
			params.forEach(function (param) {
				addParamToList(param);
			});
		});
	}

	function addParamToList(param) {
		const paramItem = document.createElement('div');
		paramItem.className = 'param-item';

		const paramText = document.createElement('span');
		paramText.textContent = param;

		const deleteButton = document.createElement('button');
		deleteButton.textContent = 'Remove';
		deleteButton.addEventListener('click', function () {
			removeParam(param);
		});

		paramItem.appendChild(paramText);
		paramItem.appendChild(deleteButton);
		paramListEl.appendChild(paramItem);
	}

	function addNewParam() {
		const newParam = newParamInput.value.trim();

		if (newParam) {
			chrome.storage.local.get(['trackingParams'], function (result) {
				const params = result.trackingParams || [];

				// Check if parameter already exists
				if (!params.includes(newParam)) {
					params.push(newParam);
					chrome.storage.local.set({ trackingParams: params });

					// Add to UI
					addParamToList(newParam);

					// Clear input
					newParamInput.value = '';
				} else {
					// Parameter already exists - could show an error message
					newParamInput.classList.add('error');
					setTimeout(() => {
						newParamInput.classList.remove('error');
					}, 1500);
				}
			});
		}
	}

	function removeParam(param) {
		chrome.storage.local.get(['trackingParams'], function (result) {
			const params = result.trackingParams || [];

			// Remove parameter
			const updatedParams = params.filter((p) => p !== param);
			chrome.storage.local.set({ trackingParams: updatedParams });

			// Reload the list
			loadTrackingParams();
		});
	}

	// Test current clipboard content
	async function testCurrentClipboard() {
		try {
			const clipboardText = await navigator.clipboard.readText();

			// Only test if it looks like a URL
			if (clipboardText.startsWith('http')) {
				chrome.runtime.sendMessage({ action: 'cleanUrl', url: clipboardText }, function (response) {
					if (response && response.cleanedUrl !== clipboardText) {
						// Show an indicator that current clipboard contains tracking
						const statsDiv = document.querySelector('.stats');
						const indicator = document.createElement('p');
						indicator.textContent = 'Current clipboard contains tracking!';
						indicator.style.color = '#f44336';
						indicator.style.fontSize = '12px';
						indicator.style.marginTop = '5px';
						statsDiv.appendChild(indicator);
					}
				});
			}
		} catch (err) {
			// Clipboard access might be denied, just ignore
			console.log('Could not access clipboard:', err);
		}
	}

	// Test current clipboard when popup opens
	testCurrentClipboard();
});
