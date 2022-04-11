const obj = {}

obj.dbClient = { a: 'MongoDB client connection object' }
obj.dbDatabase = 'mattmadethese'
obj.dbCollection = 'users'
obj._first = 'Matthew'
obj._last = 'Duffy'
obj._email = 'matt@duffy.email'
obj._password = '9@zzw0rd'

obj.requiredProperties = function() {
  return new Array('_first', '_last', '_email', '_password')
}

obj.checkRequired = function() {
  let missing = []
  for(let key of this.requiredProperties()) {
    if(!this[key] || this[key] === null || this[key] === 'undefined' || this[key] === '') {
      missing.push(key)
    }
  }
  if(missing.length > 0) {
      let msg = missing.map(item=>item.slice(1)).join(', ')
      throw new Error(`Missing the follwing required properties: ${msg}`)
  }
  return true
}

obj.serialize = function() {
		let propertiesToSerialize = ['_first', '_last', '_name', '_email', '_hashedPassword', '_created_on', '_updated_on', '_description', '_type', '_jwt', '_id']
		let that = this
		return JSON.stringify( that, propertiesToSerialize )
	}


obj.serialize1 = function() {
  let that = this
	return JSON.stringify( that, ['_first', '_last', '_email', '_password'])
}


