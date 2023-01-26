/**
 * @file ./tests/properties_test.js
 */

const obj = {}

obj.dbClient = { a: 'MongoDB client connection object' }
obj.dbDatabase = 'mattmadethese'
obj.dbCollection = 'users'
obj._first = 'Matthew'
obj._last = 'Duffy'
obj._email = 'matt@duffy.email'
obj._password = '9@zzw0rd'

obj.requiredProperties = function() {
  return ['_first', '_last', '_email', '_password']
}

obj.checkRequired = function() {
  const missing = []
  for(const key of this.requiredProperties()) {
    if(!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
      missing.push(key)
    }
  }
  if (missing.length > 0) {
    const msg = missing.map((item) => item.slice(1)).join(', ')
    throw new Error(`Missing the follwing required properties: ${msg}`)
  }
  return true
}

obj.serialize = function() {
  const propertiesToSerialize = ['_first', '_last', '_name', '_email', '_hashedPassword', '_created_on', '_updated_on', '_description', '_type', '_jwt', '_id']
  const that = this
  return JSON.stringify(that, propertiesToSerialize)
}

obj.serialize1 = function() {
  const that = this
  return JSON.stringify(that, ['_first', '_last', '_email', '_password'])
}
