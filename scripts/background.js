console.log("hi from worker");


let startTime = null;
let curTab = null;
let audibleTabs = null;


async function updateAudibleTabs() {
	audibleTabs = await chrome.tabs.query({ audible: true });
	console.log(audibleTabs);
}
updateAudibleTabs();

chrome.tabs.onActivated.addListener(async (activeInfo) => {
	const tab = await chrome.tabs.get(activeInfo.tabId);
	console.log(tab.url);

	if (curTab) {
		const timeSpent = Date.now() - startTime;
		console.log(timeSpent);
	}

	curTab = tab;
	startTime = Date.now();

	await updateAudibleTabs();

	console.log(startTime);
});
