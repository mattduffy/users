import crypto from 'node:crypto'
import Debug from 'debug'
import * as Users from '../Users.js'
// import { client, genTokens } from './db_connection_test.js'
import { genTokens } from './db_connection_test.js'

// import * as Dotenv from 'dotenv'
// Dotenv.config({ path: 'tests/.env', debug: false })
const debug = Debug('users:test_users');

(async () => {
  function r(n) { return crypto.randomBytes(n).toString('hex') }
  // function h() { if (Math.floor((Math.random() * 10)) % 2 === 1) { return 'inactive' } return 'active' }

  debug('Starting basic user account tests...')
  const properties = {
    first_name: '1234567890',
    last_name: 'slkjdlafjd',
    email: `matt@mattmail.email.${r(2)}`,
    password: '9@zzw0rd',
    jwts: genTokens(),
  }
  debug('BasicUser created properties object')
  debug('BasicUser calling Users.newUser static method with mongodb client obj and user properties obj.')
  let basicUser = Users.newUser(properties)
  // debug('BasicUser basicUser.toString: ', basicUser.toString())
  debug('BasicUser calling save() method on the new user.')

  basicUser = await basicUser.save()
  debug('BasicUser result of save() call.')
  // debug('BasicUser result: %o', basicUser.toString())
  // debug('BasicUser result: %o', basicUser)
  debug(`BasicUser result.insertedId.toString: ${basicUser.id}`)

  debug('***********************************************')
  debug('***********************************************')
  debug('BasicUser Can we update this newly created basic user now?')
  // basicUser.email = 'mail@electronic-mail.commercial'
  const newEmail = `newmatt@mattmail.email.${r(2)}`
  basicUser.email = newEmail
  basicUser = await basicUser.update()
  debug('BasicUser updated basic user: %o', basicUser.toString())

  debug('***********************************************')
  debug('***********************************************')
  debug('UserByEmail Can we find a user by email address?')
  let userByEmail
  try {
    userByEmail = await Users.findByEmail(newEmail)
  } catch (e) {
    debug(e)
  }
  debug('%O', userByEmail.toString())

  debug('***********************************************')
  debug('***********************************************')
  const { id } = userByEmail
  let userById
  debug('UserByEmail Can we find a user by id %s ?', id)
  try {
    userById = await Users.findById(id)
  } catch (e) {
    debug(e)
  }
  debug('UserById Found user: %O', userById.toString())

  debug('***********************************************')
  debug('***********************************************')
  debug('UserById Can we compare password with hashedPassword?')
  debug('COMPARE About to cmp properties.password: \'%s\' and userById.password: \'%s\'', properties.password, userById.password)
  const passwordsTheSame = await Users.cmpPassword(userById.email, properties.password)
  if (passwordsTheSame) {
    debug('COMPARE Samesies')
  } else {
    debug('COMPARE different')
  }

  debug('Starting Admin User account tests...')
  debug('***********************************************')
  debug('***********************************************')
  debug('Can we create an Admin User?')
  const adminProperties = {
    first_name: 'Adam',
    last_name: 'TheAdmin',
    email: `adam@theadmin.email.${r(2)}`,
    password: '9@zzw0rd',
    jwts: genTokens(),
  }
  debug('AdminUser created properties object')
  debug('AdminUser calling Users.newAdminUser static method with mongodb client obj and user properties obj.')
  let adminUser = await Users.newAdminUser(adminProperties)
  debug('AdminUser AdminUser.toString: %o', adminUser.toString())
  debug('AdminUser calling the save() method on the new user.')

  adminUser = await adminUser.save()
  debug('AdminUser result of save() call.')
  debug('AdminUser result: %o', adminUser.toString())
  debug(`AdminUser result.insertedId.toString: ${adminUser.id}`)
})()
