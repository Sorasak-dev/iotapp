const Joi = require('joi');

const zoneValidationSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Zone name is required',
    'any.required': 'Zone name is required'
  }),
  location: Joi.object({
    latitude: Joi.number().allow(null),
    longitude: Joi.number().allow(null),
    address: Joi.string().allow("")
  }),
  image: Joi.string().allow(null, "")
});

module.exports = { zoneValidationSchema };