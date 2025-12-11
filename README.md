# 🔔💨 I Just Farted — Beta

A fun, localized social web app that lets you broadcast your farts to friends and pin them on a map!

## 🎯 Features

### Core Features
- **Status Toggle**: Turn your broadcast status ON/OFF
- **Easy Fart Button**: Large, satisfying button to broadcast farts
- **Real-time Map**: Interactive map showing all your fart locations
- **Location Tracking**: Automatically pins farts to your current location
- **Fart Animation**: Visual effects when you broadcast
- **Vibration Feedback**: Haptic feedback on supported devices

### Social Features
- **Friends System**: Add and manage friends
- **Online Status**: See which friends are online
- **Friend Notifications**: Notify friends when you fart
- **Friends List**: View and manage your friend connections

### Reporting & Tracking
- **Fart Reports**: Add detailed reports with notes and photos
- **Statistics Dashboard**: Track your fart activity
  - Total broadcasts
  - Total reports
  - Friend count
  - Today's activity
- **Pin Management**: View and clear all pins on the map

### UI/UX
- **Hamburger Menu**: Clean, slide-out navigation
- **Notifications**: Toast-style success/error messages
- **Responsive Design**: Works on mobile and desktop
- **Modern Interface**: Clean, minimal design with smooth animations
- **Offline Support**: Works completely offline (localStorage based)

## 🚀 Getting Started

### Installation
1. Download `index.html`
2. Open it in any modern web browser
3. Allow location permissions when prompted (optional but recommended)

### Usage

1. **Go Live**: 
   - Toggle the status switch to ON in the header
   - Or use the hamburger menu → "Go Live"

2. **Broadcast a Fart**:
   - Press the large red "💨 FART" button
   - Location will be automatically captured
   - Friends will be notified

3. **Report a Fart**:
   - Click "📝 Report Fart" button at the bottom
   - Add notes or photos
   - Submit to save

4. **View Map**:
   - Hamburger menu → "View Map"
   - See all your fart pins
   - Green = broadcasts, Red = reports
   - Click "📍 Center" to focus on your location

5. **Add Friends**:
   - Hamburger menu → "Add Friends"
   - Enter username
   - Friends appear in Friends List

6. **View Statistics**:
   - Hamburger menu → "Statistics"
   - See your fart metrics

## 🛠️ Technical Details

### Technologies Used
- **HTML5**: Structure
- **CSS3**: Styling with modern animations
- **JavaScript (Vanilla)**: All functionality
- **Leaflet.js**: Interactive maps
- **OpenStreetMap**: Map tiles
- **LocalStorage**: Data persistence

### Data Storage
All data is stored locally in your browser using localStorage:
- `fart_pins_v1`: All fart broadcasts and reports
- `fart_friends_v1`: Friends list

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Permissions Required
- **Location** (optional): For pinning farts to map
- **Vibration** (optional): For haptic feedback

## 📱 Features by Section

### Header
- Hamburger menu toggle
- App title
- Live status indicator (pulses when active)

### Status Section
- ON/OFF toggle switch
- Real-time status display

### Main Button
- Large, tactile fart button
- Disabled when status is OFF
- Animated press effect

### Map
- Full-screen interactive map
- Custom markers for broadcasts (green) and reports (red)
- Zoom controls
- Center on user button
- Close button

### Report Section
- Quick report button
- Modal with text input
- Photo upload support

### Menu Options
1. **Status** → Go Live
2. **Social** → Add Friends, Friends List
3. **Map** → View Map, Clear All Pins
4. **Info** → Statistics, About

## 🔒 Privacy

- **100% Local**: All data stays in your browser
- **No Server**: No data is sent to any server
- **No Tracking**: No analytics or tracking
- **No Account**: No signup required

## 🎨 Customization

You can easily customize:
- Colors (search for hex codes like `#00d084`)
- Button size (search for `width: 220px`)
- Animation speeds (search for `transition:`)
- Map default location (search for `center:`)

## 🐛 Known Issues

- Photos in reports are selected but not stored (future feature)
- Friend online status is randomly generated (would need backend)
- No actual notifications sent to friends (would need backend)

## 🚧 Future Enhancements

- [ ] Real backend for actual friend connections
- [ ] Push notifications
- [ ] Photo storage and display
- [ ] Social feed
- [ ] Fart sound effects
- [ ] Achievement system
- [ ] Export/import data
- [ ] Dark mode
- [ ] Multiple map styles

## 📄 License

This is a beta/demo app for local testing. Feel free to modify and use as you wish!

## 🤝 Contributing

This is a local beta. To contribute:
1. Make your modifications
2. Test thoroughly
3. Share your improvements!

## 💡 Tips

- Grant location permissions for the best experience
- Keep your status ON to enable all features
- Add friends to make it more fun
- Check statistics regularly to track your activity
- Use reports for special or notable farts

## 📞 Support

This is a local beta app. For issues:
1. Check browser console for errors
2. Clear localStorage: `localStorage.clear()`
3. Refresh the page
4. Try a different browser

---

**Version**: 1.0 Beta  
**Status**: Local Testing  
**Last Updated**: December 2025

Enjoy farting responsibly! 💨
