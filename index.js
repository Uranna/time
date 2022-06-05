const dayjs = require("dayjs");
const fns = require("date-fns");

const { getMinutes, getHours, addMinutes } = fns;

class TimeOrder {
  constructor(interval) {
    this.interval = interval;
    this.state = {
      isFullDay: false
    }

    this.user = {
      address: "Петрозаводская 20",
      avatar: null,
      break: false,
      break_finish: "",
      break_start: "",
      cost_finish: "0.00 руб",
      cost_start: "1 000.00 руб",
      currency: "usd",
      duration: { h: 1, min: 0 },
      fcm_token:
        "f28PiHL0x030tvLxRnvj3v:APA91bEKiURKSSqbz_Kt8rlvtB8pHY8sbaxt0L-F-GR40dtQImL7qNNQLr8dB3iu-XEM5LIS_slaluNnh6Iiy-IyFCqThruK5lrncD7E5DnvI1LB6VOVIL5XJeu3WZzwkLZcATd9e8EE",
      fixed_date: null,
      heap_events: true,
      hours_format_24: true,
      id: 1064,
      id_service: 642,
      max_date_booking: null,
      min_date_booking: 0,
      name: "Alexander Ilinskiy",
      phone: "",
      required_instagram: false,
      required_surname: false,
      rules: "",
      time_interval: true,
      time_job:
        "Monday:10.00-20.00;Tueday:10.00-24.00;Wednesday:10.00-20.00;Thursday:10.00-20.00;Friday:10.00-20.00;Saturday:10.00-20.00;Sunday:10.00-20.00;",
      title_service: "3D окрашивание",
      _id: 0,
    }

    this.getDurationInMin = this.getDurationInMin.bind(this)
    this.getInterval = this.getInterval.bind(this);

    this.direction = {
      'DEFAULT': 0,
      'FROM_FINISH': 1,
      'TO_CENTER': 2
    }

    this.currentInterval = this.prepareTime(this.interval, 90, { year: 2022, month: 5, day: 29 }, this.user);

    console.log(this.currentInterval?.filter(({ show, active }) => show || active))
  }

  getDurationInMin = (time) => {
    return getHours(time) === 0 ? 1440 + getMinutes(time) : getHours(time) * 60 + getMinutes(time);
  }

  formatDate = (date, time) => {
    const timeCheck = time.split(':')[0] === '24';
    if (timeCheck) time = time.replace('24', '00');
    let createDate = new Date(`${date.year}/${date.month}/${date.day} ${time}`);
    return timeCheck ? dayjs(createDate).add(1, 'day').$d : createDate;
  }

  createInterval = ({ ts, tf }, date) => {
    ts = this.formatDate(date, ts);
    tf = this.formatDate(date, tf);
    const startDayWork = this.getDurationInMin(ts);
    const finishDayWork = this.getDurationInMin(tf);

    const fullDay = {
      interval: {
        ts,
        tf,
        startMinute: startDayWork,
        finishMinute: finishDayWork
      }
    }

    let interval = []

    return {
      setInterval: ({ ts, tf, ev_date, duration }, step, date) => {
        if (duration === 0 || duration < step) return;

        if (ev_date === null) {
          ts = fullDay.interval.ts;
          tf = fullDay.interval.tf;
          ev_date = dayjs(fullDay.ts).format('YYYY-MM-DD')
          interval = [...interval, ...this.getInterval(ts, tf, startDayWork, finishDayWork, ev_date, step)];
          return;
        }

        ts = this.formatDate(date, ts);
        tf = this.formatDate(date, tf);

        const startInterval = this.getDurationInMin(ts, date);
        const finishInterval = this.getDurationInMin(tf, date);

        const enableStart = startDayWork === startInterval;
        const enableFinish = finishDayWork === finishInterval;

        let direction = this.direction.DEFAULT;

        if (!enableFinish) {
          if (enableStart) direction = this.direction.FROM_FINISH;
          else direction = this.direction.TO_CENTER;
        }

        interval = [...interval, ...this.getInterval(ts, tf, startInterval, finishInterval, ev_date, step, direction)]
      },

      getInterval: () => interval.sort((firstTime, secondTime) => firstTime.interval.startMinute - secondTime.interval.startMinute),
      getFullDay: () => fullDay
    }
  }

  getInterval(ts, tf, start, finish, ev_date, duration, direction = 0) {
    let interval = [];
    let from_left = direction === this.direction.FROM_FINISH ? false : true;

    while (start < finish) {
      if (start + duration > finish) {
        duration = finish - start;
      }

      if (from_left) {
        interval.push({
          ev_date,
          interval: {
            start: ts,
            end: addMinutes(ts, duration),
            startMinute: start,
            finishMinute: start + duration,
            duration
          }
        })
        ts = addMinutes(ts, duration);
        start += duration;
      }

      else {
        interval.push({
          ev_date,
          interval: {
            start: addMinutes(tf, -duration),
            end: tf,
            startMinute: finish - duration,
            finishMinute: finish,
            duration
          }
        })
        tf = addMinutes(tf, -duration)
        finish -= duration
      }
      from_left = direction === this.direction.TO_CENTER ? !from_left : from_left;
    }
    return interval
  }

  prepareTime = (timeArray, step, date, user) => {
    const fullDayInterval = timeArray.find(interval => interval.ev_date === null)
    const createInterval = this.createInterval(fullDayInterval, date);

    if (timeArray.length === 1 && timeArray[0].ev_date === null) this.state.isFullDay = true;

    if (this.state.isFullDay) {
      createInterval.setInterval(fullDayInterval, step, date)
    }
    else {
      timeArray.forEach(interval => {
        if (interval.ev_date === null) return;
        createInterval.setInterval(interval, step, date);
      });
    }

    let interval = createInterval.getInterval();
    const fullDay = createInterval.getFullDay();

    if (this.state.isFullDay) {
      interval.forEach(time => {
        if (time.interval.duration === step)
          time.show = true
      })

      let fullInterval = []
      interval.reduce((prev, current, currentIndex) => {
        fullInterval.push(prev)
        if (prev.interval.finishMinute === current.interval.startMinute) {
          let start = prev.interval.startMinute + prev.interval.finishMinute % 15;
          while (prev.interval.finishMinute > start && start + step <= current.interval.finishMinute) {
            if (start === prev.interval.startMinute) {
              start += 15;
              continue;
            }
            fullInterval.push({
              ev_date: prev.ev_date,
              interval: {
                startMinute: start,
                finishMinute: start + step,
              },
              active: prev.interval.duration < step
            })
            start += 15;
          }
        }
        if (currentIndex === interval.length - 1) fullInterval.push(current)
        return current
      })
      // console.log(fullInterval)
      return interval
    }

    interval.reduce((prev, current, currentIndex) => {
      if (currentIndex === 1 && prev.interval.startMinute !== fullDay.interval.startMinute) prev.show = true;

      if (currentIndex === interval.length - 1 && current.interval.finishMinute !== fullDay.interval.finishMinute) current.show = true;

      if (current.interval.startMinute - prev.interval.startMinute > step) {
        current.show = true;
        prev.show = true;
      }
      return current
    })
    return interval
  }
}


new TimeOrder([
  // { ev_date: "2022-05-29", ts: "10:00:00", tf: "10:30:00", duration: 30 },
  // { ev_date: "2022-05-29", ts: "10:30:00", tf: "14:45:00", duration: 2*60 + 15 },
  // { ev_date: "2022-05-29", ts: "14:45:00", tf: "15:00:00", duration: 15 },
  { ev_date: null, ts: "10:00:00", tf: "15:00:00", duration: 5 * 60 },
])


