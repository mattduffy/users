require('dotenv').config()
const debug = require('debug')('@mattduffy/users')
const User = require('../User.js')
const {client, genTokens} = require('./db_connection_test.js')

debug('I: setting minimum required user properties.')
let user1 = new User(client)
user1.password = '9@zzw0rd'
debug('II: ', user1.password)
user1.firstName = 'Matthew'
user1.lastName = 'Duffy'
user1.email = 'matt@email.duffy';
user1.jwts = genTokens();

let saveResults;
(async function() {
  if(user1.checkRequired()) {
    debug('III: checkRequired returned true')
    debug('IV: about to call user1.save()')
    const result = await user1.save()
    debug('V: ', result)
    saveResults = result
    debug('VI: user1._id set?: ', user1._id)
  } 
})();

debug('VII: access saveResults outside of IIFE?: ', saveResults)

