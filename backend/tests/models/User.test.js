const mongoose = require('mongoose');
const User = require('../../models/User');
const bcrypt = require('bcrypt');

describe('User Model Tests', () => {
  
  describe('User Schema Validation', () => {
    it('should create a user with valid data', async () => {
      const validUser = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User',
        phone: '0812345678'
      };

      const user = new User(validUser);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.email).toBe(validUser.email.toLowerCase());
      expect(savedUser.name).toBe(validUser.name);
      expect(savedUser.password).not.toBe(validUser.password); // Should be hashed
    });

    it('should fail without required email', async () => {
      const userWithoutEmail = new User({
        password: 'SecurePass123!'
      });

      await expect(userWithoutEmail.save()).rejects.toThrow();
    });

    it('should fail without required password', async () => {
      const userWithoutPassword = new User({
        email: 'test@example.com'
      });

      await expect(userWithoutPassword.save()).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'Pass123!'
      };

      await User.create(userData);
      const duplicateUser = new User(userData);

      await expect(duplicateUser.save()).rejects.toThrow();
    });

    it('should lowercase email automatically', async () => {
      const user = await User.create({
        email: 'TEST@EXAMPLE.COM',
        password: 'Pass123!'
      });

      expect(user.email).toBe('test@example.com');
    });

    it('should trim email whitespace', async () => {
      const user = await User.create({
        email: '  test@example.com  ',
        password: 'Pass123!'
      });

      expect(user.email).toBe('test@example.com');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const plainPassword = 'MySecurePassword123!';
      const user = new User({
        email: 'hash@example.com',
        password: plainPassword
      });

      await user.save();

      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toHaveLength(60); // bcrypt hash length
    });

    it('should verify hashed password with bcrypt', async () => {
      const plainPassword = 'MySecurePassword123!';
      const user = await User.create({
        email: 'verify@example.com',
        password: plainPassword
      });

      const isMatch = await bcrypt.compare(plainPassword, user.password);
      expect(isMatch).toBe(true);
    });

    it('should not rehash password if not modified', async () => {
      const user = await User.create({
        email: 'nohash@example.com',
        password: 'Pass123!'
      });

      const originalHash = user.password;
      user.name = 'Updated Name';
      await user.save();

      expect(user.password).toBe(originalHash);
    });

    it('should rehash password when modified', async () => {
      const user = await User.create({
        email: 'rehash@example.com',
        password: 'OldPass123!'
      });

      const originalHash = user.password;
      user.password = 'NewPass123!';
      await user.save();

      expect(user.password).not.toBe(originalHash);
    });
  });

  describe('Username Handling', () => {
    it('should allow null username', async () => {
      const user = await User.create({
        email: 'nullusername@example.com',
        password: 'Pass123!'
      });

      expect(user.username).toBeNull();
    });

    it('should convert empty string username to null', async () => {
      const user = new User({
        email: 'emptyusername@example.com',
        password: 'Pass123!',
        username: ''
      });

      await user.save();
      expect(user.username).toBeNull();
    });

    it('should accept unique username', async () => {
      const user = await User.create({
        email: 'uniqueuser@example.com',
        password: 'Pass123!',
        username: 'uniqueuser'
      });

      expect(user.username).toBe('uniqueuser');
    });

    it('should trim username whitespace', async () => {
      const user = await User.create({
        email: 'trimuser@example.com',
        password: 'Pass123!',
        username: '  testuser  '
      });

      expect(user.username).toBe('testuser');
    });
  });

  describe('Zones Management', () => {
    it('should initialize with empty zones array', async () => {
      const user = await User.create({
        email: 'zones@example.com',
        password: 'Pass123!'
      });

      expect(user.zones).toEqual([]);
    });

    it('should create a zone with valid data', async () => {
      const user = await User.create({
        email: 'createzone@example.com',
        password: 'Pass123!'
      });

      user.zones.push({
        name: 'Living Room',
        location: {
          latitude: 18.7883,
          longitude: 98.9853,
          address: 'Chiang Rai, Thailand'
        }
      });

      await user.save();

      expect(user.zones).toHaveLength(1);
      expect(user.zones[0].name).toBe('Living Room');
      expect(user.zones[0].location.address).toBe('Chiang Rai, Thailand');
    });

    it('should set default zone using createDefaultZone method', async () => {
      const user = await User.create({
        email: 'defaultzone@example.com',
        password: 'Pass123!'
      });

      await user.createDefaultZone();

      expect(user.zones).toHaveLength(1);
      expect(user.zones[0].name).toBe('Your Zone');
      expect(user.zones[0].isDefault).toBe(true);
      expect(user.currentZoneId).toEqual(user.zones[0]._id);
    });

    it('should not create duplicate default zones', async () => {
      const user = await User.create({
        email: 'nodupzone@example.com',
        password: 'Pass123!'
      });

      await user.createDefaultZone();
      await user.createDefaultZone(); // Should not add another

      expect(user.zones).toHaveLength(1);
    });

    it('should allow multiple zones per user', async () => {
      const user = await User.create({
        email: 'multizones@example.com',
        password: 'Pass123!'
      });

      user.zones.push(
        { name: 'Living Room' },
        { name: 'Bedroom' },
        { name: 'Kitchen' }
      );

      await user.save();

      expect(user.zones).toHaveLength(3);
    });
  });

  describe('Query Operations', () => {
    it('should find user by email', async () => {
      await User.create({
        email: 'findme@example.com',
        password: 'Pass123!'
      });

      const found = await User.findOne({ email: 'findme@example.com' });
      expect(found).toBeDefined();
      expect(found.email).toBe('findme@example.com');
    });

    it('should find user by id', async () => {
      const user = await User.create({
        email: 'findbyid@example.com',
        password: 'Pass123!'
      });

      const found = await User.findById(user._id);
      expect(found).toBeDefined();
      expect(found.email).toBe('findbyid@example.com');
    });

    it('should update user fields', async () => {
      const user = await User.create({
        email: 'updateme@example.com',
        password: 'Pass123!'
      });

      user.name = 'Updated Name';
      user.phone = '0898765432';
      await user.save();

      const updated = await User.findById(user._id);
      expect(updated.name).toBe('Updated Name');
      expect(updated.phone).toBe('0898765432');
    });

    it('should delete user', async () => {
      const user = await User.create({
        email: 'deleteme@example.com',
        password: 'Pass123!'
      });

      await User.findByIdAndDelete(user._id);

      const deleted = await User.findById(user._id);
      expect(deleted).toBeNull();
    });
  });
});