chrome.runtime.onInstalled.addListener(() => {
	// Set default tracking parameters to remove
	chrome.storage.local.get(['trackingParams'], (result) => {
		if (!result.trackingParams) {
			chrome.storage.local.set({
				trackingParams: [
					'utm_source',
					'utm_medium',
					'utm_campaign',
					'utm_term',
					'utm_content',
					'fbclid',
					'gclid',
					'msclkid',
					'dclid',
					'zanpid',
					'igshid',
					'_hsenc',
					'_hsmi',
					'mc_cid',
					'mc_eid',
					'ref',
					'referrer',
					'source',
					'gb',
					'affiliate',
					'cmp',
					'cmpid',
					'fb_action_ids',
					'fb_action_types',
					'fb_source',
					'fb_ref',
					'ga_source',
					'ga_medium',
					'ga_term',
					'ga_content',
					'ga_campaign',
					'ga_place',
					'action_object_map',
					'action_type_map',
					'action_ref_map',
					'gs_l',
					'mkt_tok',
					'hmb_campaign',
					'hmb_source',
					'hmb_medium',
				],
			});
		}
	});

	// Set default user preferences
	chrome.storage.local.get(['userPreferences'], (result) => {
		if (!result.userPreferences) {
			chrome.storage.local.set({
				userPreferences: {
					showNotifications: true,
					cleanByDefault: false,
					trackingRemoved: 0,
				},
			});
		}
	});

	// .create returns a promise so if a menu is dependent on another, await them
	chrome.contextMenus.create({
		id: 'cleanPaste',
		title: 'Paste Clean URL',
		type: 'normal',
		contexts: ['editable'],
	});
});

// --- Omnibox func ---
chrome.omnibox.onInputEntered.addListener(async (text) => {
	let url = text.trim();

	if (!url.startsWith('http')) {
		url = 'https://' + url;
	}

	try {
		// Wait for the cleanUrl Promise to resolve
		const cleanedUrl = await cleanUrl(url);
		console.log('Cleaned URL:', cleanedUrl); 

		chrome.tabs.update({ url: cleanedUrl });
	} catch (error) {
		console.error('Error cleaning URL:', error);
		// Fallback to original URL if cleaning fails
		chrome.tabs.update({ url: url });
	}
});

// If user clicks on the new context item send message to content script to perfrom clean paste action
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === 'cleanPaste') {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs.length > 0) {
				chrome.tabs.sendMessage(tabs[0].id, { action: 'performCleanPaste' }, (response) => {
					if (chrome.runtime.lastError) {
						console.log('Content script not ready yet:', chrome.runtime.lastError.message);
					}
				});
			}
		});
	}
});
// Same as above but for keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
	if (command === 'clean-paste') {
		// as defined in manifest.json
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]) {
				chrome.tabs.sendMessage(tabs[0].id, { action: 'performCleanPaste' });
			}
		});
	}
});

// Helper function to clean URLs
function cleanUrl(url) {
	try {
		if (!url || typeof url !== 'string') {
			return Promise.resolve('');
		}

		const urlObj = new URL(url);

		// Get the list of tracking parameters to remove
		return new Promise((resolve) => {
			chrome.storage.local.get(['trackingParams'], (result) => {
				const trackingParams = result.trackingParams || [];

				const params = new URLSearchParams(urlObj.search);
				let paramRemoved = false;

				// Cycle through and remove tracking parameters
				trackingParams.forEach((param) => {
					if (params.has(param)) {
						params.delete(param);
						paramRemoved = true;
					}
				});

				// If removed succesfully increment the counter
				if (paramRemoved) {
					chrome.storage.local.get(['userPreferences'], (result) => {
						const prefs = result.userPreferences || {};
						prefs.trackingRemoved = (prefs.trackingRemoved || 0) + 1;
						chrome.storage.local.set({ userPreferences: prefs });
					});
				}

				// Rebuild the URL without the tracking parameters
				urlObj.search = params.toString();
				resolve(urlObj.toString());
			});
		});
	} catch (e) {
		// If the input is not a valid URL, return it unchanged
		return Promise.resolve(url || '');
	}
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'cleanUrl') {
		cleanUrl(request.url).then((cleanedUrl) => {
			sendResponse({ cleanedUrl });
		});
		return true; // Required for async response
	} else if (request.action === 'getStats') {
		chrome.storage.local.get(['userPreferences'], (result) => {
			sendResponse({ stats: result.userPreferences || {} });
		});
		return true;
	}
});

// Create content script programmatically
chrome.runtime.onInstalled.addListener(() => {
	chrome.tabs.query({}, (tabs) => {
		tabs.forEach((tab) => {
			if (tab.url && tab.url.startsWith('http')) {
				chrome.scripting
					.executeScript({
						target: { tabId: tab.id },
						files: ['content.js'],
					})
					.catch((err) => console.error('Error injecting content script:', err));
			}
		});
	});
});
