require('dotenv').config()
const debug = require('debug')('@mattduffy/users')
const User = require('../User.js')
const { client, genTokens } = require('./db_connection_test.js')

debug('****, Setting minimum required user properties.')
const user1 = new User(client)
user1.password = '9@zzw0rd'
debug('****, ', user1.password)
user1.firstName = 'Matthew'
user1.lastName = 'Duffy'
user1.email = 'matt@email.duffy'
user1.jwts = genTokens()

function getSaveResults() {
  return user1.save()
}

(async () => {
  const result = await getSaveResults()
  console.log('result: ', result)
  debug('****, ', result)
})()

if (user1.checkRequired()) {
  debug('****, checkRequired returned true')
  debug('****, about to call user1.save()')
}
