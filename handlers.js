const low = require('lowdb');
const axios = require('axios');
const FileSync = require('lowdb/adapters/FileSync');

const TIME_MAX = 30 * 24 * 60 * 60 * 1000;

const usersDB = low(new FileSync('db/users.json'));
usersDB.defaults({ users: [] }).write();
const eventsDB = low(new FileSync('db/events.json'));
eventsDB.defaults({ events: [] }).write();

function filterEvents(events) {
  const filtered = [];
  for (let ev of events) {
    filtered.push({
      startTime: ev.start.dateTime,
      endTime: ev.end.dateTime,
    });
  }
  return filtered;
}

function listUserCalendars(userData) {
  console.log(`Loading calendars from ${userData.name}...`);

  axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { 'Authorization': `Bearer ${userData.token}` } })
    .then(res => {
      const calendars = res.data.items;
      usersDB.get('users').find({ id: userData.id }).set('events', []).write();
      for (let cal of calendars) {
        if (cal.id.indexOf('@group.v.calendar.google.com') === -1) {
          listUserCalendarEvents(userData, cal.id);
        }
      }
    })
    .catch(err => console.log(err.message));
}

function listUserCalendarEvents(userData, calId) {
  console.log('Getting events for ' + calId);

  axios.get(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      params: {
        timeMin: (new Date(Date.now())).toISOString(),
        timeMax: (new Date(Date.now() + TIME_MAX)).toISOString(),
      },
      headers: { 'Authorization': `Bearer ${userData.token}` }
    })
    .then(res => {
      const events = filterEvents(res.data.items);
      console.log(`Found ${events.length} events in: ${calId}`);
      usersDB.get('users').find({ id: userData.id }).get('events').push(...events).write();
    })
    .catch(err => console.log(err.message));
}

module.exports = {
  handleStrategy: (accessToken, refreshToken, profile, done) => {
    const userData = {
      id: profile.id,
      token: accessToken,
      name: profile.displayName,
      email: profile.emails,
      photos: profile.photos,
      events: []
    };

    const user = usersDB.get('users').find({ id: profile.id }).value();
    if (user == null) {
      usersDB.get('users').push(userData).write();
    }

    console.log(userData);
    done(null, userData);
    listUserCalendars(userData);
  },
  handleCallback: (req, res) => {
    console.log(`Logged in user successfully...`);
    console.log(req.query);
    res.redirect('/dashboard');
  },
  handleCreatePost: (req, res) => {
    res.send('');
  },
  handleMeetingData: (req, res) => {
    res.send('hey')
  },
  handleJoinEvent: (req, res) => {
  }
};
