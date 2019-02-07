/**
 * @fileoverview
 * @enhanceable
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

goog.exportSymbol('proto.types.PeerAddress', null, global);

/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.types.PeerAddress = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.types.PeerAddress, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  proto.types.PeerAddress.displayName = 'proto.types.PeerAddress';
}


if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto suitable for use in Soy templates.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     com.google.apps.jspb.JsClassTemplate.JS_RESERVED_WORDS.
 * @param {boolean=} opt_includeInstance Whether to include the JSPB instance
 *     for transitional soy proto support: http://goto/soy-param-migration
 * @return {!Object}
 */
proto.types.PeerAddress.prototype.toObject = function(opt_includeInstance) {
  return proto.types.PeerAddress.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Whether to include the JSPB
 *     instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.types.PeerAddress} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.types.PeerAddress.toObject = function(includeInstance, msg) {
  var f, obj = {
    address: jspb.Message.getFieldWithDefault(msg, 1, ""),
    port: jspb.Message.getFieldWithDefault(msg, 2, 0),
    peerid: msg.getPeerid_asB64()
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.types.PeerAddress}
 */
proto.types.PeerAddress.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.types.PeerAddress;
  return proto.types.PeerAddress.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.types.PeerAddress} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.types.PeerAddress}
 */
proto.types.PeerAddress.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {string} */ (reader.readString());
      msg.setAddress(value);
      break;
    case 2:
      var value = /** @type {number} */ (reader.readUint32());
      msg.setPort(value);
      break;
    case 3:
      var value = /** @type {!Uint8Array} */ (reader.readBytes());
      msg.setPeerid(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.types.PeerAddress.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.types.PeerAddress.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.types.PeerAddress} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.types.PeerAddress.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getAddress();
  if (f.length > 0) {
    writer.writeString(
      1,
      f
    );
  }
  f = message.getPort();
  if (f !== 0) {
    writer.writeUint32(
      2,
      f
    );
  }
  f = message.getPeerid_asU8();
  if (f.length > 0) {
    writer.writeBytes(
      3,
      f
    );
  }
};


/**
 * optional string address = 1;
 * @return {string}
 */
proto.types.PeerAddress.prototype.getAddress = function() {
  return /** @type {string} */ (jspb.Message.getFieldWithDefault(this, 1, ""));
};


/** @param {string} value */
proto.types.PeerAddress.prototype.setAddress = function(value) {
  jspb.Message.setField(this, 1, value);
};


/**
 * optional uint32 port = 2;
 * @return {number}
 */
proto.types.PeerAddress.prototype.getPort = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 2, 0));
};


/** @param {number} value */
proto.types.PeerAddress.prototype.setPort = function(value) {
  jspb.Message.setField(this, 2, value);
};


/**
 * optional bytes peerID = 3;
 * @return {!(string|Uint8Array)}
 */
proto.types.PeerAddress.prototype.getPeerid = function() {
  return /** @type {!(string|Uint8Array)} */ (jspb.Message.getFieldWithDefault(this, 3, ""));
};


/**
 * optional bytes peerID = 3;
 * This is a type-conversion wrapper around `getPeerid()`
 * @return {string}
 */
proto.types.PeerAddress.prototype.getPeerid_asB64 = function() {
  return /** @type {string} */ (jspb.Message.bytesAsB64(
      this.getPeerid()));
};


/**
 * optional bytes peerID = 3;
 * Note that Uint8Array is not supported on all browsers.
 * @see http://caniuse.com/Uint8Array
 * This is a type-conversion wrapper around `getPeerid()`
 * @return {!Uint8Array}
 */
proto.types.PeerAddress.prototype.getPeerid_asU8 = function() {
  return /** @type {!Uint8Array} */ (jspb.Message.bytesAsU8(
      this.getPeerid()));
};


/** @param {!(string|Uint8Array)} value */
proto.types.PeerAddress.prototype.setPeerid = function(value) {
  jspb.Message.setField(this, 3, value);
};


goog.object.extend(exports, proto.types);
