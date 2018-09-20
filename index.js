const iconv = require('iconv-lite')
const MongoClient = require('mongodb').MongoClient
const traverse = require('traverse')
const dbTypes = ["unconfirmed", "confirmed"]
const validKeys = new Set([
  "_id",
  "opcodenum",

  "request",
  "response",
  "encoding",
  "find",
  "aggregate",
  "project",
  "sort",
  "limit",
  "distinct",

  "tx",
  "tx.hash",

  "block",
  "block.hash",
  "block.time",
  "block.index",

  "input",
  "input.index",
  "input.b0", "input.b1", "input.b2", "input.b3", "input.b4", "input.b5", "input.b6", "input.b7", "input.b8", "input.b9", "input.b10", "input.b11", "input.b12", "input.b13", "input.b14", "input.b15", "input.b16", 
  "input.sender",
  "input.sender.a",
  "input.sender.tx",
  "input.sender.index",

  "output",
  "output.index",
  "output.b0", "output.b1", "output.b2", "output.b3", "output.b4", "output.b5", "output.b6", "output.b7", "output.b8", "output.b9", "output.b10", "output.b11", "output.b12", "output.b13", "output.b14", "output.b15", "output.b16",
  "output.s0", "output.s1", "output.s2", "output.s3", "output.s4", "output.s5", "output.s6", "output.s7", "output.s8", "output.s9", "output.s10", "output.s11", "output.s12", "output.s13", "output.s14", "output.s15", "output.s16",
  "output.receiver",
  "output.receiver.a",
  "output.receiver.index",
  "output.receiver.v"
])
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
        cursor = cursor.sort({block_index: -1})
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
var validate = function(subtree) {
  let isvalid = true;
  traverse(subtree).forEach(function(token) {
    if (this.key) {
      if(validKeys.has(this.key)) {
        // valid
      } else if (this.key[0] === '$') {
        // valid
      } else {
        // invalid
        isvalid = false;
      }
    }
  })
  return isvalid;
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
          if (/^(in|out)put\.b[0-9]+/.test(node.key)) {
            break
          }
        }
      }

      if (encoding_schema && encoding_schema[node.key]) {
        encoding = encoding_schema[node.key]
      }

      if (/^(in|out)put\.b[0-9]+/.test(node.key)) {
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
          if (/^(in|out)put\.b[0-9]+/.test(node.key)) {
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
  read: read
}
