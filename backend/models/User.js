const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// ใหม่: สร้าง Schema สำหรับ Zone
const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Zone name is required"],
    trim: true,
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: "" }
  },
  image: {
    type: String,
    default: null
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    // ใหม่: เพิ่มฟิลด์ zones ใน User model
    zones: {
      type: [zoneSchema],
      default: [],
    },
    // ใหม่: เพิ่มฟิลด์ currentZoneId เพื่อเก็บ zone ที่กำลังใช้อยู่
    currentZoneId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    devices: [{ type: mongoose.Schema.Types.ObjectId, ref: "Device" }], 
    data: {
      type: [
        {
          sensorId: {
            type: String,
            required: [true, "Sensor ID is required"],
            trim: true,
          },
          temperature: {
            type: Number,
            required: false,
          },
          humidity: {
            type: Number,
            required: false,
          },
          timestamp: {
            type: Date,
            required: [true, "Timestamp is required"],
          },
        },
      ],
      default: [],
      validate: {
        validator: function (data) {
          const uniqueEntries = new Set(
            data.map((item) => `${item.sensorId}-${item.timestamp.toISOString()}`)
          );
          return uniqueEntries.size === data.length;
        },
        message: "Duplicate sensor data detected in user data.",
      },
    },
  },
  { timestamps: true } 
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ใหม่: เพิ่ม method สำหรับสร้าง default zone หากผู้ใช้ยังไม่มี zone ใดๆ
userSchema.methods.createDefaultZone = async function() {
  if (this.zones.length === 0) {
    const defaultZone = {
      name: "Your Zone",
      isDefault: true,
      location: {
        address: "Default Location"
      }
    };
    this.zones.push(defaultZone);
    this.currentZoneId = this.zones[0]._id;
    await this.save();
  }
};

module.exports = mongoose.model("User", userSchema);