# Fart Status App (Beta v1.2)

This is a single-page web application combining the features of "I Just Farted" and "Fart Status".

## Features

-   **Go Live Status**: Toggle your online status to enable the broadcast button.
-   **3D Easy Button**: An interactive 3D button (powered by Three.js) to broadcast your status.
-   **Global Map**: View a heatmap/pins of where you've broadcasted from (stored locally).
-   **Mini Map**: A popup map appears when you broadcast to confirm location.
-   **Friends List**: Add and manage a list of friends (simulated online status).
-   **Reporting**: Submit detailed reports with descriptions.
-   **Localized Storage**: All data (pins, friends) is saved to your browser's `localStorage`.

## How to Run

1.  Open the `index.html` file in any modern web browser.
2.  Allow **Location Access** when prompted (required for map features).
3.  Toggle the "Status" switch to **Live**.
4.  Press the Big Red Button!

## Libraries Used
-   **Leaflet.js**: For map rendering.
-   **Three.js**: For the 3D button rendering.
