Client Responsibilities:

* Capturing the clicks on the battleship grids
* Render the UI from HTML + CSS
* Sending data to backend

Server Responsibilities:

* Calculates data from frontend
* Preserves a secret game state
* Sends data back to frontend
* Makes decisions and "hunts" for user ships

Where Game State Lives:	

* It lives in the server's memory
* A record of every coordinate fired is kept
* A visual state is also kept in the RAM of the client's browser

How State Transitions Occur

* Client sends data (clicks on grid) to server
* Server processes the data
* Gets whatever other data it may need
* Packs it up nicely and sends it to the client
* Repeat
