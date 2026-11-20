// Starts a Godot export from the page addons/nswp/web/shell.html, in place of the script Godot writes into its
// own page. It shows nothing itself: how far the engine has arrived is told to the crossing's room
// (NSWP.loading), which is what the visitor is looking at, and so is a failure to start (NSWP.failed). The room's
// doors open when the world asks for its menu (Nswp.menu in GDScript), which is the world saying it is up.
(function () {
	"use strict";
	var room = window.NSWP || { loading: function () {}, failed: function () {} };
	var config;
	try {
		config = JSON.parse(document.getElementById("godot-config").textContent);
	} catch (err) {
		return room.failed("This world's page is incomplete, so it couldn't start.");
	}
	var threads = document.currentScript && document.currentScript.dataset.threads === "true";
	var words = function (err) {
		if (err instanceof Error) return err.message;
		return typeof err === "string" ? err : "This world couldn't start.";
	};
	if (typeof Engine !== "function") return room.failed("The engine didn't arrive. Reloading the page tries again.");
	var missing = Engine.getMissingFeatures({ threads: threads });
	if (missing.length !== 0) return room.failed("This browser is missing what the world needs: " + missing.join(", ") + ".");
	room.loading(-1);
	new Engine(config)
		.startGame({
			onProgress: function (current, total) {
				room.loading(current > 0 && total > 0 ? current / total : -1);
			},
		})
		.then(
			function () {
				// The engine is running. The doors wait for the world itself: its first scene is still being made.
				room.loading(1);
			},
			function (err) {
				console.error(err);
				room.failed(words(err));
			},
		);
})();
