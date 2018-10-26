# youtube_playlister

## setup

Create a playlist.json with the following format:

	{
		"playlist name" : {
			"song name" : "youtube id for song"
		}
	}

You can have multiple playlists and multiple songs per playlist.

## use

Run index.html and click the playlist you want to play. It will be shuffled.

## export

To export your existing YouTube playlist, go to a song in the playlist and then run this:

	javascript:var Description = "Export YouTube playlists. This script is in the Public Domain - created at: 2016-11-21";
	function printline(myLine) {
		document.write(myLine+"\n");
	};
	function showlinks() {
		var today = new Date();
		var day = today.getDate();
		var month = today.getMonth()+1;
		var year = today.getFullYear();
		document.write("<html><head><title>YouTube list: " + Title + "</title></head><body>");
		printline("<textarea name='Links' rows='55' cols='200'>");
		for (i=0; i<lines.length; i++) printline(lines[i]);
		printline("</textarea>");
		document.write("</body></html>");
	};
	var url = document.URL;
	var body = document.body.innerHTML;
	var lines = [];
	if (url.match(/youtube.com/)) {
		var x = body.match(/data-list-title=.*/)[0];
		var x = x.replace(/.*data-list-title="/, '');
		var Title = x.replace(/".*/, '');
		if (body.match(/li class=.yt-uix-scroller-scroll-unit/)) {
			var matches = body.match(/li class=.yt-uix-scroller-scroll-unit.*/g);
			for(i=0; i<matches.length; i++) {
				var x = matches[i];
				var ID = x.replace(/.*data-video-id=./, "");
				var ID = ID.replace(/".*/, "");
				var VName = x.replace(/.*data-video-title=./, "");
				var VName = VName.replace(/".*/, "");
				var VName = VName.replace(/&quot;/g, "\\&quot;");
				console.log(VName);
				var x = "\t\t\"" + VName + "\" : \"" + ID + "\"";
				if(i != matches.length - 1) x += ",";
				lines.push(x);
			};
		};
	};
	showlinks();

