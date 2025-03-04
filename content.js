// content.js: clipboard interaction, displaying notifications

async function performCleanPaste() {
	try {
		const clipboardText = await navigator.clipboard.readText();

		// Send message to background script to do cleanUrl action
		chrome.runtime.sendMessage({ action: 'cleanUrl', url: clipboardText }, function (response) {
			if (response && response.cleanedUrl) {
				// Get the active element (where cursor is)
				const activeElement = document.activeElement;

				if (
					activeElement &&
					(activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
				) {
					// Insert the cleaned URL at cursor position
					if (activeElement.isContentEditable) {
						// Handle contenteditable elements (like rich text editors)
						document.execCommand('insertText', false, response.cleanedUrl);
					} else {
						// Handle input and textarea elements
						const start = activeElement.selectionStart;
						const end = activeElement.selectionEnd;
						const value = activeElement.value;

						activeElement.value = value.substring(0, start) + response.cleanedUrl + value.substring(end);

						// Move cursor to end of inserted text
						activeElement.selectionStart = activeElement.selectionEnd = start + response.cleanedUrl.length;
					}

					// Show notification if different from original
					if (response.cleanedUrl !== clipboardText) {
						chrome.storage.local.get(['userPreferences'], function (result) {
							const prefs = result.userPreferences || {};
							if (prefs.showNotifications) {
								showNotification('Tracking parameters removed!');
							}
						});
					}
				}
			}
		});
	} catch (err) {
		console.error('Error accessing clipboard:', err);
	}
}

// Function to show a small notification
function showNotification(message) {
	// Create notification element
	const notification = document.createElement('div');
	notification.textContent = message;
	notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #4CAF50;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      transition: opacity 0.3s;
    `;

	// Add to page
	document.body.appendChild(notification);

	// Remove after 2 seconds
	setTimeout(() => {
		notification.style.opacity = '0';
		setTimeout(() => {
			document.body.removeChild(notification);
		}, 300);
	}, 2000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'performCleanPaste') {
		performCleanPaste();
	}
	return true;
});
