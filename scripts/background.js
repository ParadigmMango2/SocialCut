console.log("hi from worker");
let startTime = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const tab = await chrome.tabs.get(activeInfo.tabId);
	console.log(tab.url);

	const timeSpent = Date.now() - startTime;
	startTime = Date.now();
	console.log(startTime);
	console.log(timeSpent);
});
