const low = require('lowdb');
const axios = require('axios');
const suuid = require('short-uuid');
const nodemailer = require('nodemailer');
const FileSync = require('lowdb/adapters/FileSync');

const TIME_MAX = 30 * 24 * 60 * 60 * 1000;

const idGen = suuid();
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'meetusist@gmail.com',
    pass: 'rising gently scorecard'
  }
});

const usersDB = low(new FileSync('db/users.json'));
usersDB.defaults({ users: [] }).write();
const eventsDB = low(new FileSync('db/events.json'));
eventsDB.defaults({ events: [] }).write();

// ===== INTERSECTION

function createArray(arrLength) {
  var arr = new Array(arrLength || 0).join('0').split('').map(parseFloat);
  for (let k = 0; k < 32; k++) {
    arr[k] = 1;
  }

  let i = arrLength;
  if (arguments.length > 1) {
    var args = Array.prototype.slice.call(arguments, 1);
    while (i--) arr[arrLength - 1 - i] = createArray.apply(this, args);
  }

  return arr;
}

function findSlots(userList, firstPossibleDay, lastPossibleDay, minimumNumberOfSlotsNeeded) {
  console.log("firstPossibleDay-> " + firstPossibleDay);
  console.log("lastPossibleDay-> " + lastPossibleDay);
  console.log("minimumNumberOfSlotsNeeded-> " + minimumNumberOfSlotsNeeded);

  var eventStart;
  var eventStartDate;
  var eventEnd;

  var numberUsers = userList.length;

  //createArray(pessoas,timeslots) - apenas 1 dia
  var occupiedSlots = createArray(numberUsers, 96);
  var possibleDayBeingTested = firstPossibleDay;

  var freeSlotsFound = new Array();
  while ((freeSlotsFound.length == 0) && (possibleDayBeingTested <= lastPossibleDay)) {
    console.log("possibleDayBeingTested " + possibleDayBeingTested);
    for (let u = 0; u < userList.length; u++) {

      var userEvents = userList[u].events.sort((ev1, ev2) => new Date(ev1.startTime) - new Date(ev2.startTime))

      console.log("user numero -> " + u);

      for (let i = 0; i < userEvents.length; i++) {
        var moment = require('moment');
        var momentDate;

        var eventStart;
        var eventEnd;
        var eventStartDate;
        var eventEndDate;

        //Start
        eventStart = userEvents[i].startTime
        eventStart = eventStart.replace("T", " ").replace("Z", " ");

        //2018-06-21 13:00:56

        momentDate = moment(eventStart, 'YYYY-MM-DD HH:mm:ss');
        eventStartDate = momentDate.toDate();

        //End
        eventEnd = userEvents[i].endTime
        eventEnd = eventEnd.replace("T", " ").replace("Z", " ");

        momentDate = moment(eventEnd, 'YYYY-MM-DD HH:mm:ss');
        eventEndDate = momentDate.toDate();

        var startDay = eventStartDate.getDate();

        if (startDay == possibleDayBeingTested) {
          //occupied event slot		
          var startSlot = eventStartDate.getHours() * 4 + Math.ceil(eventStartDate.getMinutes() / 15);
          var endSlot = eventEndDate.getHours() * 4 + Math.ceil(eventEndDate.getMinutes() / 15);

          console.log("Dia " + possibleDayBeingTested);
          console.log(startSlot);
          console.log(endSlot);

          var j = startSlot;
          while (j <= endSlot) {
            occupiedSlots[u][j] = 1;
            j++;
          }
        }
      }
    }

    freeSlotsFound = hasSlotBeenFound(numberUsers, occupiedSlots, minimumNumberOfSlotsNeeded);
    possibleDayBeingTested++;

  }

  for (var a of freeSlotsFound) {
    var m = a * 15;
    var h = Math.floor(m / 60);
    m = m - (h * 60);
    console.log("Free slot start " + h + "h " + m + "m");
  }
  //console.log (freeSlotsFound);
}

function hasSlotBeenFound(numberUsers, occupiedSlots, minimumNumberOfSlotsNeeded) {
  var i, j, k;
  var uninterrupted;
  var foundSlotsStart = new Array;

  var freeSlots = createArray(96);

  for (i = 0; i < numberUsers; i++) {
    for (j = 0; j < 96; j++) {
      freeSlots[j] = freeSlots[j] + occupiedSlots[i][j]
    }
  }

  for (j = 0; j < 96; j++) {
    if (freeSlots[j] == 0) {
      uninterrupted = true
      for (k = 0; k < minimumNumberOfSlotsNeeded; k++) {
        if (freeSlots[j + k] != 0) {
          //someone has a plan in conflict
          uninterrupted = false;
        }
      }
      if (uninterrupted) {
        //weve found a slot!
        foundSlotsStart.push(j);
      }
    }
  }
  return foundSlotsStart;
}

// ===== INTERSECTION

function sendEmail(eventData, slots) {
  const { title, description } = eventData.opts;
  const mailList = eventData.members.join(',');
  const mailOpts = {
    from: 'meetusist@gmail.com',
    to: mailList,
    subject: `MeetUs: Your event [${title}] is scheduled!`,
    text: `
    this is a sample email, please cope with :D
    Description: ${description}
    ` //todo: put slots
  };
  mailTransporter.sendMail(mailOpts, (err, data) => {
    console.log(data.response);
  });
}

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
  createPost: (req, res) => {
    console.log(req.query);
    const id = idGen.new();
    const event = {
      id,
      opts: req.query,
      members: []
    }
    console.log(event);
    eventsDB.get('events').push(event).write();
    res.send({ event: id });
  },
  handleMeetingData: (req, res) => {
    const { id } = req.params;
    const eventData = eventsDB.get('events').find({ id }).value();
    console.log(eventData);
    if (eventData) {
      res.send(eventData);
    } else {
      res.send({ "error": "event not found" });
    }
  },
  handleJoinEvent: (req, res) => {
  },
  handleEndEvent: (req, res) => {
    const { id } = req.params;
    const eventData = eventsDB.get('events').find({ id }).value();
    const eventMins = eventData.opts.duration;

    console.log('Closing event ' + id);
    eventsDB.get('events').find({ id }).update('id', id => id + "_123").write();
    res.send({ 'done': 'event closed' });
    // calculate data
    const slots = findSlots(usersDB.get('users').value(), 1, 1, eventMins / 15);
    // send email
    sendEmail(eventData, slots);
  }
};
