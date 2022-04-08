require('dotenv').config();
const assert = require('assert');

class User {
	constructor(config){
		if(!config || typeof config == 'undefined') {
			throw new Error("Can't create an empty user.");
		}
		this._first = config.first_name;
		this._last = config.last_name;
		this._name = `${config.first_name} ${config.last_name}`;
		this._email = config.email || '';
		this._created_on = Date.now();
		this._description = `Instances of this type of user are not meant to be used directly.  This class is meant to be used as a base class to create more specific types of users.`;
		this._type = `User`;
	}

	set firstName(first) {
		this._first = first;
	}
	get firstName() {
		return this._first;
	}
	set lastName(last) {
		this._last = last;
	}
	get lastName() {
		return this._last;
	}
	set email(email) {
		this._email = email;
	}
	get email() {
		return this._email;
	}
	set name(newName) {
		this._name = newName;
	}
	get name() {
		return this._name;
	}
	get description() {
		return this._description;
	}
	get type() {
		return this._type;
	}
}

class TestUser {
	constructor() {
		console.log("not really meant to create instances of this class.  Use the static methods instead.");
	}
	static isSameUser(a,b) {
		return assert.ok(a === b);
	}

	static notEquals(a,b) {
		return assert.notEqual(a,b);
	}
	static equals(a,b){
		return assert.ok(a == b);
	}
}

module.exports = {
	User,
	TestUser
};

