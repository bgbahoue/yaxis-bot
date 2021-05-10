/**
 * Date and time utilities for Ethereun contracts
 * Inspired from https://github.com/pipermerriam/ethereum-datetime
*/

const DAY_IN_SECONDS = 86400;
const YEAR_IN_SECONDS = 31536000;
const LEAP_YEAR_IN_SECONDS = 31622400;
const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;

const ORIGIN_YEAR = 1970;

// =======================================================================
// PRIVATE METHODS
// =======================================================================
function isLeapYear(year) {
	if (year % 4 != 0) {
		return false;
	}
	if (year % 100 != 0) {
		return true;
	}
	if (year % 400 != 0) {
		return false;
	}
	return true;
}

function leapYearsBefore(year) {
	year -= 1;
	return year / 4 - year / 100 + year / 400;
}

function getDaysInMonth(month, year) {
	if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
		return 31;
	}
	else if (month == 4 || month == 6 || month == 9 || month == 11) {
		return 30;
	}
	else if (isLeapYear(year)) {
		return 29;
	}
	else {
		return 28;
	}
}

// =======================================================================
// PUBLIC METHODS
// =======================================================================
/**
 * Transforms an ETH timestamp into a Date object
 * 
 * @param {String} [timestamp]
 * 
 * @return {Date} {year, month, day, hour, minute, second, weekday}
*/
function parseTimestamp(timestamp) {
	var secondsAccountedFor = 0;
	var buf;
	var i;
	var dt = {};

	// Year
	dt.year = getYear(timestamp);
	buf = leapYearsBefore(dt.year) - leapYearsBefore(ORIGIN_YEAR);

	secondsAccountedFor += LEAP_YEAR_IN_SECONDS * buf;
	secondsAccountedFor += YEAR_IN_SECONDS * (dt.year - ORIGIN_YEAR - buf);

	// Month
	var secondsInMonth;
	for (i = 1; i <= 12; i++) {
		secondsInMonth = DAY_IN_SECONDS * getDaysInMonth(i, dt.year);
		if (secondsInMonth + secondsAccountedFor > timestamp) {
			dt.month = i;
			break;
		}
		secondsAccountedFor += secondsInMonth;
	}

	// Day
	for (i = 1; i <= getDaysInMonth(dt.month, dt.year); i++) {
		if (DAY_IN_SECONDS + secondsAccountedFor > timestamp) {
			dt.day = i;
			break;
		}
		secondsAccountedFor += DAY_IN_SECONDS;
	}

	// Hour
	dt.hour = getHour(timestamp);

	// Minute
	dt.minute = getMinute(timestamp);

	// Second
	dt.second = getSecond(timestamp);

	// Day of week.
	dt.weekday = getWeekday(timestamp);

	return dt;
}

function getYear(timestamp) {
	var secondsAccountedFor = 0;
	var year;
	var numLeapYears;

	// Year
	year = parseInt(ORIGIN_YEAR + timestamp / YEAR_IN_SECONDS);
	numLeapYears = leapYearsBefore(year) - leapYearsBefore(ORIGIN_YEAR);

	secondsAccountedFor += LEAP_YEAR_IN_SECONDS * numLeapYears;
	secondsAccountedFor += YEAR_IN_SECONDS * (year - ORIGIN_YEAR - numLeapYears);

	while (secondsAccountedFor > timestamp) {
		if (isLeapYear(parseInt(year - 1))) {
			secondsAccountedFor -= LEAP_YEAR_IN_SECONDS;
		}
		else {
			secondsAccountedFor -= YEAR_IN_SECONDS;
		}
		year -= 1;
	}
	return year;
}

function getMonth(timestamp) {
	return parseTimestamp(timestamp).month;
}

function getDay(timestamp) {
	return parseTimestamp(timestamp).day;
}

function getHour(timestamp) {
	return parseInt((timestamp / 60 / 60) % 24);
}

function getMinute(timestamp) {
	return parseInt((timestamp / 60) % 60);
}

function getSecond(timestamp) {
	return parseInt(timestamp % 60);
}

function getWeekday(timestamp) {
	return parseInt((timestamp / DAY_IN_SECONDS + 4) % 7);
}

function toTimestamp(year, month, day, hour=0, minute=0, second=0) {
	var i;

	// Year
	for (i = ORIGIN_YEAR; i < year; i++) {
		if (isLeapYear(i)) {
			timestamp += LEAP_YEAR_IN_SECONDS;
		}
		else {
			timestamp += YEAR_IN_SECONDS;
		}
	}

	// Month
	var monthDayCounts = [];
	monthDayCounts[0] = 31;
	if (isLeapYear(year)) {
		monthDayCounts[1] = 29;
	}
	else {
		monthDayCounts[1] = 28;
	}
	monthDayCounts[2] = 31;
	monthDayCounts[3] = 30;
	monthDayCounts[4] = 31;
	monthDayCounts[5] = 30;
	monthDayCounts[6] = 31;
	monthDayCounts[7] = 31;
	monthDayCounts[8] = 30;
	monthDayCounts[9] = 31;
	monthDayCounts[10] = 30;
	monthDayCounts[11] = 31;

	for (i = 1; i < month; i++) {
		timestamp += DAY_IN_SECONDS * monthDayCounts[i - 1];
	}

	// Day
	timestamp += DAY_IN_SECONDS * (day - 1);

	// Hour
	timestamp += HOUR_IN_SECONDS * (hour);

	// Minute
	timestamp += MINUTE_IN_SECONDS * (minute);

	// Second
	timestamp += second;

	return timestamp;
}

module.exports = { 
	parseTimestamp, toTimestamp,
	getYear, getMonth, getDay, getHour, getMinute, getSecond, getWeekday
};