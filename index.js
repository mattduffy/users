const User = require('./User.js').User;

if (process.argv.length < 3 || -1 == process.argv.slice(2)[0].indexOf('test')) {

	console.log(process.argv.slice(2)[0]);
	console.log('Script not called with --test argument.');
	console.log('Nothing to test in that case.');

} else {
	require('dotenv').config();
	const colors = require('colors');
	const testuser = require('./User.js').TestUser;

	colors.setTheme({
		silly: 'rainbow',
		input: 'grey',
		verbose: 'cyan',
		prompt: 'grey',
		info: 'green',
		data: 'grey',
		help: 'cyan',
		warn: 'yellow',
		debug: 'blue',
		error: 'red'
	});

	let user1 = new User({'first_name': 'test', 'last_name': 'user'});
	let user2 = new User({'first_name': 'test', 'last_name': 'user'});
	let user3 = user1;

	console.log(testuser.equals(user1, user1));
	console.log(testuser.notEquals(user1, user2));
	console.log(testuser.isSameUser(user1, user3));

	try {
		let repository = process.env.REPOSITORY;
		console.debug(repository.debug);
		const user2 = new User({'name': 'Matt Duffy'});
		console.log(`user name is ${user2.name}`.info);
		user1 = new User();
	} catch(e) {
		console.log(e.message.error);
	} finally {
		console.info("that's all for now".help);
	}

	let prom = new Promise((resolve, reject) => {
		setTimeout(()=>{
			let min = 10;
			let max = 49;
			let rando = Math.floor(Math.random() * (max - min)) + min;
			console.log(`rando is ${rando}`.info);
			if (rando % 2 == 0) {
				resolve(rando);
				} else {
					reject(rando);
				}
			}, 2500);
	});
	
	prom.then((result)=>{console.log(`even ${result}`)})
		.catch((result)=>{console.error(`odd ${result}`.error)})
		.finally(()=>{console.info(`finally...finished with that promise stuff`.help)});
}
