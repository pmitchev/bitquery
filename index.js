const iconv = require('iconv-lite')
const MongoClient = require('mongodb').MongoClient
const traverse = require('traverse')
const dbTypes = ["unconfirmed", "confirmed"]
var db, client
var timeout = null
var read = async function(r) {
  let result = {}
  if (r.request) {
    let query = r.request
    if (r.request.find) {
      query.find = encode(r.request.find, r.request.encoding)
    } else if (r.request.aggregate) {
      query.aggregate = encode(r.request.aggregate, r.request.encoding)
    }
    let src = (r.request.db && r.request.db.length > 0) ? r.request.db : dbTypes
    let promises = []
    for (let i=0; i<src.length; i++) {
      let key = src[i]
      if (dbTypes.indexOf(key) >= 0) {
        promises.push(lookup({ request: query, response: r.response }, key))
      }
    }
    try {
      let responses = await Promise.all(promises)
      responses.forEach(function(response) {
        result[response.name] = response.items
      })
    } catch (e) {
      console.log("Error", e)
      if (result.errors) {
        result.errors.push(e.toString())
      } else {
        result.errors = [e.toString()]
      }
    }
  }
  return result
}
var exit = function() {
  client.close()
}
var init = function(config) {
  return new Promise(function(resolve, reject) {
    let url = (config && config.url ? config.url : "mongodb://localhost:27017")
    let name = (config && config.name ? config.name : "bitdb")
    let sockTimeout = (config && config.timeout) ? config.timeout + 100 : 20100
    if (/mongodb:.*/.test(url)) {
      MongoClient.connect(url, {
        useNewUrlParser: true,
        socketTimeoutMS: sockTimeout
      }, function(err, _client) {
        if (err) console.log(err)
        client = _client
        if (config && config.timeout) {
          timeout = config.timeout
        }
        db = client.db(name)
        resolve({ read: read, exit: exit })
      })
    } else {
      reject("Invalid Node URL")
    }
  })
}
var lookup = function(r, collectionName) {
  let collection = db.collection(collectionName)
  let query = r.request
  return new Promise(async function(resolve, reject) {
    let cursor
    if (query.find || query.aggregate) {
      if (query.find) {
        cursor = collection.find(query.find, { allowDiskUse:true })
      } else if (query.aggregate) {
        cursor = collection.aggregate(query.aggregate, { allowDiskUse:true })
      }
      if (query.sort) {
        cursor = cursor.sort(query.sort)
      } else {
        cursor = cursor.sort({'blk.i': -1})
      }
      if (query.project) {
        cursor = cursor.project(query.project)
      }
      if (query.limit) {
        cursor = cursor.limit(query.limit)
      } else {
        cursor = cursor.limit(100)
      }
      if (timeout) {
        cursor = cursor.maxTimeMS(timeout)
      }

      cursor.toArray(function(err, docs) {
        if (err) {
          reject(err)
        } else {
          if (r.response && r.response.encoding) {
            let transformed = decode(docs, r.response.encoding)
            resolve({
              name: collectionName,
              items: transformed
            })
          } else {
            resolve({
              name: collectionName,
              items: docs
            })
          }
        }
      })

    } else if (query.distinct) {
      if (query.distinct.field) {
        try {
          let items = await collection.distinct(query.distinct.field, query.distinct.query, query.distinct.options)
          resolve({
            name: collectionName,
            items: items
          })
        } catch (e) {
          reject(e)
        }
      }
    }
  })
}
var encode = function(subtree, encoding_schema) {
  let copy = subtree
  traverse(copy).forEach(function(token) {
    if (this.isLeaf) {
      let encoding = "utf8"
      let newVal = token
      let node = this
      if (/^([0-9]+|\$).*/.test(node.key)) {
        while(!node.isRoot) {
          node = node.parent
          if (/^(in|out)\.b[0-9]+/.test(node.key)) {
            break
          }
        }
      }

      if (encoding_schema && encoding_schema[node.key]) {
        encoding = encoding_schema[node.key]
      }

      if (/^(in|out)\.b[0-9]+/.test(node.key)) {
        newVal = iconv.encode(token, encoding).toString("base64")
      }
      this.update(newVal)
    }
  })
  return copy
}
var decode = function(subtree, encoding_schema) {
  let copy = subtree
  traverse(copy).forEach(function(token) {
    if (this.isLeaf) {
      let encoding = "base64"
      let newVal = token
      let node = this
      if (/^([0-9]+|\$).*/.test(node.key)) {
        while(!node.isRoot) {
          node = node.parent
          if (/^(in|out)\.b[0-9]+/.test(node.key)) {
            break
          }
        }
      }
      let currentKey = node.path.filter(function(p) {
        return !/^[0-9]+$/.test(p)
      }).join(".")
      if (encoding_schema && encoding_schema[currentKey]) {
        encoding = encoding_schema[currentKey]
      }
      if (/^b[0-9]+/.test(node.key)) {
        newVal = iconv.encode(token, "base64").toString(encoding)
      }
      this.update(newVal)
    }
  })
  return copy
}
module.exports = {
  init: init,
  exit: exit,
  read: read
}
