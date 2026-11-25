package com.jeevanam.sms;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Sends a text message straight from the app (no SMS app opens). Long messages
 * are split into parts automatically. The call resolves once the phone reports
 * whether every part left the device, so the app can tell "sent" from "failed".
 */
@CapacitorPlugin(
    name = "JeevanamSms",
    permissions = { @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS }) }
)
public class JeevanamSmsPlugin extends Plugin {

    /** Give up waiting for the phone's "sent" report after this long. */
    private static final long REPORT_TIMEOUT_MS = 25000;

    private final AtomicInteger requestCounter = new AtomicInteger();

    /** Whether this device can send SMS at all, and whether a SIM is ready. */
    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        boolean supported = context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY);
        boolean simReady = false;
        if (supported) {
            TelephonyManager telephony = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            simReady = telephony != null && telephony.getSimState() == TelephonyManager.SIM_STATE_READY;
        }
        JSObject result = new JSObject();
        result.put("supported", supported);
        result.put("simReady", simReady);
        call.resolve(result);
    }

    @PluginMethod
    public void send(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "afterPermission");
            return;
        }
        sendNow(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            sendNow(call);
        } else {
            call.reject("Permission to send SMS was not granted.", "PERMISSION_DENIED");
        }
    }

    private void sendNow(PluginCall call) {
        String to = call.getString("to");
        String message = call.getString("message");
        if (to == null || to.trim().isEmpty() || message == null || message.isEmpty()) {
            call.reject("Missing phone number or message.", "INVALID");
            return;
        }

        Context context = getContext();
        final String action = context.getPackageName() + ".SMS_SENT_" + requestCounter.incrementAndGet();

        ArrayList<String> parts;
        SmsManager manager;
        try {
            manager = smsManager(context);
            parts = manager.divideMessage(message);
        } catch (Exception e) {
            resolveFailure(call, "This phone can't send SMS.");
            return;
        }

        SentReport report = new SentReport(context, call, parts.size());
        ContextCompat.registerReceiver(context, report, new IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED);
        report.armTimeout();

        Intent intent = new Intent(action).setPackage(context.getPackageName());
        PendingIntent sent = PendingIntent.getBroadcast(
            context,
            requestCounter.get(),
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        ArrayList<PendingIntent> sentIntents = new ArrayList<>();
        for (int i = 0; i < parts.size(); i++) sentIntents.add(sent);

        try {
            manager.sendMultipartTextMessage(to.trim(), null, parts, sentIntents, null);
        } catch (SecurityException e) {
            report.fail("Permission to send SMS was denied.");
        } catch (Exception e) {
            report.fail("Could not send to this number.");
        }
    }

    @SuppressWarnings("deprecation")
    private SmsManager smsManager(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return context.getSystemService(SmsManager.class);
        }
        return SmsManager.getDefault();
    }

    private static void resolveFailure(PluginCall call, String error) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("error", error);
        call.resolve(result);
    }

    private static String describe(int resultCode) {
        switch (resultCode) {
            case SmsManager.RESULT_ERROR_NO_SERVICE:
                return "No mobile signal.";
            case SmsManager.RESULT_ERROR_RADIO_OFF:
                return "Airplane mode is on.";
            case SmsManager.RESULT_ERROR_NULL_PDU:
                return "The number or message is not valid.";
            default:
                return "The phone could not send it. Check that the SIM has an active plan with SMS.";
        }
    }

    /** Collects the per-part "sent" reports and resolves the call exactly once. */
    private class SentReport extends BroadcastReceiver {

        private final Context context;
        private final PluginCall call;
        private final int totalParts;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private int reported = 0;
        private int firstFailure = Activity.RESULT_OK;
        private boolean finished = false;

        SentReport(Context context, PluginCall call, int totalParts) {
            this.context = context;
            this.call = call;
            this.totalParts = totalParts;
        }

        void armTimeout() {
            handler.postDelayed(() -> fail("The phone did not confirm sending. Check the SIM has signal and an active plan."), REPORT_TIMEOUT_MS);
        }

        @Override
        public void onReceive(Context c, Intent intent) {
            if (finished) return;
            int code = getResultCode();
            if (code != Activity.RESULT_OK && firstFailure == Activity.RESULT_OK) firstFailure = code;
            reported++;
            if (reported >= totalParts) {
                if (firstFailure == Activity.RESULT_OK) succeed();
                else fail(describe(firstFailure));
            }
        }

        private void finish() {
            finished = true;
            handler.removeCallbacksAndMessages(null);
            try {
                context.unregisterReceiver(this);
            } catch (IllegalArgumentException ignored) {
                // already unregistered
            }
        }

        void succeed() {
            if (finished) return;
            finish();
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
        }

        void fail(String error) {
            if (finished) return;
            finish();
            resolveFailure(call, error);
        }
    }
}
