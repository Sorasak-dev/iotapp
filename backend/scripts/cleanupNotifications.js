// scripts/cleanupNotifications.js
const mongoose = require('mongoose');
const pushNotificationService = require('../services/pushNotificationService');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/auth-demo";

async function cleanupNotifications() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    console.log('🧹 Starting notification system cleanup...\n');

    // 1. Clean up old push tokens
    console.log('📱 Cleaning up old push tokens...');
    try {
      const tokenResult = await pushNotificationService.cleanupOldTokens(30);
      console.log(`✅ Deactivated ${tokenResult.modifiedCount} old push tokens (older than 30 days)`);
    } catch (error) {
      console.error('❌ Token cleanup failed:', error.message);
    }

    // 2. Clean up old notifications
    console.log('\n📮 Cleaning up old notifications...');
    try {
      const notificationResult = await pushNotificationService.cleanupOldNotifications(90);
      console.log(`✅ Deleted ${notificationResult.deletedCount} old notifications (older than 90 days)`);
    } catch (error) {
      console.error('❌ Notification cleanup failed:', error.message);
    }

    // 3. Process pending notifications
    console.log('\n🔄 Processing pending notifications...');
    try {
      const queueResult = await pushNotificationService.processDeliveryQueue();
      console.log(`✅ Processed ${queueResult.processed} pending notifications`);
    } catch (error) {
      console.error('❌ Queue processing failed:', error.message);
    }

    // 4. Get statistics
    console.log('\n📊 Current system statistics:');
    try {
      const activeTokens = await PushToken.countDocuments({ isActive: true });
      const totalTokens = await PushToken.countDocuments();
      const pendingNotifications = await Notification.countDocuments({ deliveryStatus: 'pending' });
      const failedNotifications = await Notification.countDocuments({ deliveryStatus: 'failed' });
      const deliveredNotifications = await Notification.countDocuments({ deliveryStatus: 'delivered' });

      console.log(`   📱 Push Tokens: ${activeTokens} active / ${totalTokens} total`);
      console.log(`   📮 Notifications: ${pendingNotifications} pending, ${failedNotifications} failed, ${deliveredNotifications} delivered`);

      // Get delivery stats for last 7 days
      const deliveryStats = await pushNotificationService.getDeliveryStats(7);
      console.log(`   📈 Last 7 days delivery stats:`, deliveryStats);

    } catch (error) {
      console.error('❌ Stats retrieval failed:', error.message);
    }

    // 5. Identify problematic tokens
    console.log('\n🔍 Identifying problematic push tokens...');
    try {
      const problematicTokens = await PushToken.find({
        isActive: true,
        failureCount: { $gte: 3 }
      }).select('deviceInfo.platform deviceInfo.deviceName failureCount lastFailure');

      if (problematicTokens.length > 0) {
        console.log(`⚠️ Found ${problematicTokens.length} tokens with high failure rates:`);
        problematicTokens.forEach(token => {
          console.log(`   - ${token.deviceInfo.platform} ${token.deviceInfo.deviceName || 'Unknown'}: ${token.failureCount} failures`);
        });
      } else {
        console.log('✅ No problematic tokens found');
      }
    } catch (error) {
      console.error('❌ Token analysis failed:', error.message);
    }

    // 6. Check for failed notifications that can be retried
    console.log('\n🔄 Checking for retryable failed notifications...');
    try {
      const retryableNotifications = await Notification.find({
        deliveryStatus: 'failed',
        retryCount: { $lt: 3 },
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: { $exists: false } }
        ]
      });

      if (retryableNotifications.length > 0) {
        console.log(`🔄 Found ${retryableNotifications.length} notifications that can be retried`);
        console.log('💡 These will be automatically retried by the delivery queue processor');
      } else {
        console.log('✅ No retryable failed notifications found');
      }
    } catch (error) {
      console.error('❌ Retry check failed:', error.message);
    }

    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 Consider running this script weekly for optimal performance');

  } catch (error) {
    console.error('❌ Cleanup script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No actual cleanup will be performed\n');
}

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Cleanup script interrupted');
  await mongoose.connection.close();
  process.exit(0);
});

// Run the cleanup
cleanupNotifications();