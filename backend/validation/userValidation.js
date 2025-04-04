const Joi = require('joi');

const userValidationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'string.empty': 'Password is required',
  }),
});

const userDataValidationSchema = Joi.object({
  newData: Joi.object({
    sensorId: Joi.string().required().messages({
      'string.empty': 'Sensor ID is required',
    }),
    temperature: Joi.number().allow(null).messages({
      'number.base': 'Temperature must be a number',
    }),
    humidity: Joi.number().allow(null).messages({
      'number.base': 'Humidity must be a number',
    }),
    timestamp: Joi.date().required().messages({
      'date.base': 'Invalid timestamp format',
      'any.required': 'Timestamp is required',
    }),
  }).required().messages({
    'object.base': 'Sensor data must be an object',
    'any.required': 'Sensor data is required',
  }),
});

const deviceValidationSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  image: Joi.string().required(),
  deviceId: Joi.string().required(),
  location: Joi.object({
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null),
    address: Joi.string().allow("")
  })
});

const locationValidationSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null),
    address: Joi.string().allow("")
  }).required()
});

module.exports = { 
  userValidationSchema, 
  userDataValidationSchema,
  deviceValidationSchema,
  locationValidationSchema
};