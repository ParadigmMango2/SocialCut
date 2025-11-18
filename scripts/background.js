console.log("hi from worker");
let startTime = null;
let curTab = null;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const tab = await chrome.tabs.get(activeInfo.tabId);
	console.log(tab.url);

	if (curTab) {
		const timeSpent = Date.now() - startTime;
		console.log(timeSpent);
	}

	curTab = tab;
	startTime = Date.now();

	console.log(startTime);
});
