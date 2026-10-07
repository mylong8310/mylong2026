package com.fitbalance.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class FitDatabase extends SQLiteOpenHelper {
    private static final String DB_NAME = "fitbalance.db";
    private static final int DB_VERSION = 4;
    private static final int ZHUANGZI_TOTAL_DAYS = 30;
    private final Context context;
    private final String appVersion;
    private final int versionCode;
    private final String gitSha;
    private final String ruleVersion;
    private final String contentVersion;
    private final String evidenceVersion;

    public FitDatabase(
            Context context,
            String appVersion,
            int versionCode,
            String gitSha,
            String ruleVersion,
            String contentVersion,
            String evidenceVersion) {
        super(context, DB_NAME, null, DB_VERSION);
        this.context = context.getApplicationContext();
        this.appVersion = appVersion;
        this.versionCode = versionCode;
        this.gitSha = gitSha;
        this.ruleVersion = ruleVersion;
        this.contentVersion = contentVersion;
        this.evidenceVersion = evidenceVersion;
        ensureZhuangziSeeded();
        ensureHealthRulesSeeded();
        ensureFoodSeeded();
        ensureStartDate();
        ensureAuditTables();
        recordInstalledVersion();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        createCoreTables(db);
        createHealthRuleTables(db);
        createFoodTables(db);
        createStepTables(db);
        createAuditTables(db);
    }

    private void createCoreTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS zhuangzi_content (" +
                        "id INTEGER PRIMARY KEY," +
                        "day_no INTEGER UNIQUE NOT NULL," +
                        "chapter TEXT NOT NULL," +
                        "title TEXT NOT NULL," +
                        "original_text TEXT NOT NULL," +
                        "story TEXT NOT NULL," +
                        "interpretation TEXT NOT NULL," +
                        "action TEXT NOT NULL," +
                        "mood_tags TEXT NOT NULL," +
                        "health_tags TEXT NOT NULL," +
                        "priority INTEGER NOT NULL DEFAULT 0," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS zhuangzi_progress (" +
                        "day_no INTEGER PRIMARY KEY," +
                        "checked INTEGER NOT NULL DEFAULT 0," +
                        "checked_at TEXT" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS app_meta (" +
                        "key TEXT PRIMARY KEY," +
                        "value TEXT" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS sync_queue (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "entity_type TEXT NOT NULL," +
                        "entity_id TEXT," +
                        "operation TEXT NOT NULL," +
                        "payload TEXT," +
                        "created_at TEXT NOT NULL," +
                        "synced INTEGER NOT NULL DEFAULT 0" +
                        ")"
        );
    }

    private void createHealthRuleTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS evidence (" +
                        "id TEXT PRIMARY KEY," +
                        "title TEXT NOT NULL," +
                        "organization TEXT NOT NULL," +
                        "year INTEGER NOT NULL," +
                        "url TEXT NOT NULL," +
                        "evidence_level TEXT NOT NULL," +
                        "scope TEXT NOT NULL," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS food_disease_rules (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "food_id TEXT NOT NULL," +
                        "disease TEXT NOT NULL," +
                        "status TEXT NOT NULL," +
                        "reason TEXT NOT NULL," +
                        "evidence_id TEXT NOT NULL," +
                        "content_version INTEGER NOT NULL DEFAULT 1," +
                        "UNIQUE(food_id,disease)" +
                        ")"
        );

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_food_rules_food ON food_disease_rules(food_id)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_food_rules_disease ON food_disease_rules(disease)");
    }

    private void createFoodTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS food_sources (" +
                        "id TEXT PRIMARY KEY," +
                        "name TEXT NOT NULL," +
                        "region TEXT," +
                        "kind TEXT," +
                        "license_note TEXT," +
                        "url TEXT," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS foods (" +
                        "id TEXT PRIMARY KEY," +
                        "name TEXT NOT NULL," +
                        "icon TEXT," +
                        "category TEXT," +
                        "state TEXT," +
                        "basis TEXT NOT NULL," +
                        "kcal REAL NOT NULL," +
                        "protein REAL NOT NULL," +
                        "carbs REAL NOT NULL," +
                        "fat REAL NOT NULL," +
                        "fiber REAL," +
                        "sodium REAL," +
                        "purine TEXT," +
                        "source_id TEXT NOT NULL," +
                        "source_note TEXT," +
                        "content_version INTEGER NOT NULL DEFAULT 1" +
                        ")"
        );

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category)");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source_id)");
    }

    private void createStepTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS daily_steps (" +
                        "date TEXT PRIMARY KEY," +
                        "steps INTEGER NOT NULL DEFAULT 0," +
                        "source TEXT NOT NULL," +
                        "confidence TEXT NOT NULL," +
                        "raw_counter REAL," +
                        "boot_id TEXT," +
                        "updated_at TEXT NOT NULL" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS daily_metrics (" +
                        "date TEXT PRIMARY KEY," +
                        "intake_kcal REAL NOT NULL DEFAULT 0," +
                        "protein_g REAL NOT NULL DEFAULT 0," +
                        "carbs_g REAL NOT NULL DEFAULT 0," +
                        "fat_g REAL NOT NULL DEFAULT 0," +
                        "steps INTEGER NOT NULL DEFAULT 0," +
                        "activity_kcal REAL NOT NULL DEFAULT 0," +
                        "exercise_min REAL NOT NULL DEFAULT 0," +
                        "meditation_min REAL NOT NULL DEFAULT 0," +
                        "weight_kg REAL," +
                        "cigarettes REAL NOT NULL DEFAULT 0," +
                        "alcohol_g REAL NOT NULL DEFAULT 0," +
                        "late_hours REAL NOT NULL DEFAULT 0," +
                        "red_food_count INTEGER NOT NULL DEFAULT 0," +
                        "updated_at TEXT NOT NULL" +
                        ")"
        );
    }

    private void createAuditTables(SQLiteDatabase db) {
        db.execSQL(
                "CREATE TABLE IF NOT EXISTS release_audit (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "app_version TEXT NOT NULL," +
                        "version_code INTEGER NOT NULL," +
                        "schema_version INTEGER NOT NULL," +
                        "rule_version TEXT NOT NULL," +
                        "content_version TEXT NOT NULL," +
                        "evidence_version TEXT NOT NULL," +
                        "git_sha TEXT NOT NULL," +
                        "installed_at TEXT NOT NULL," +
                        "UNIQUE(app_version,version_code,git_sha)" +
                        ")"
        );

        db.execSQL(
                "CREATE TABLE IF NOT EXISTS migration_audit (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "from_version INTEGER NOT NULL," +
                        "to_version INTEGER NOT NULL," +
                        "migrated_at TEXT NOT NULL," +
                        "notes TEXT" +
                        ")"
        );
    }

    private void ensureAuditTables() {
        SQLiteDatabase db = getWritableDatabase();
        createAuditTables(db);
    }

    private void recordInstalledVersion() {
        SQLiteDatabase db = getWritableDatabase();

        ContentValues v = new ContentValues();
        v.put("app_version", appVersion);
        v.put("version_code", versionCode);
        v.put("schema_version", DB_VERSION);
        v.put("rule_version", ruleVersion);
        v.put("content_version", contentVersion);
        v.put("evidence_version", evidenceVersion);
        v.put("git_sha", gitSha);
        v.put("installed_at", nowIso());
        db.insertWithOnConflict("release_audit", null, v, SQLiteDatabase.CONFLICT_IGNORE);

        ContentValues meta = new ContentValues();
        meta.put("key", "schema_version");
        meta.put("value", String.valueOf(DB_VERSION));
        db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

        meta.clear();
        meta.put("key", "app_version");
        meta.put("value", appVersion);
        db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

        meta.clear();
        meta.put("key", "version_code");
        meta.put("value", String.valueOf(versionCode));
        db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

        meta.clear();
        meta.put("key", "git_sha");
        meta.put("value", gitSha);
        db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        int from = oldVersion;

        if (oldVersion < 2) {
            createHealthRuleTables(db);
        }

        if (oldVersion < 3) {
            createAuditTables(db);
            ContentValues migration = new ContentValues();
            migration.put("from_version", from);
            migration.put("to_version", 3);
            migration.put("migrated_at", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date()));
            migration.put("notes", "Add immutable release and migration audit tables; existing user data preserved.");
            db.insert("migration_audit", null, migration);
        }

        if (oldVersion < 4) {
            createFoodTables(db);
            createStepTables(db);
            ContentValues migration = new ContentValues();
            migration.put("from_version", Math.max(from, 3));
            migration.put("to_version", 4);
            migration.put("migrated_at", new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date()));
            migration.put("notes", "Add source-aware food catalog and native daily step ledger; existing data preserved.");
            db.insert("migration_audit", null, migration);
        }
    }

    private String nowIso() {
        return new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(new Date());
    }

    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private String readAsset(String name) throws Exception {
        try (InputStream in = context.getAssets().open(name);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void ensureZhuangziSeeded() {
        SQLiteDatabase db = getWritableDatabase();
        long count = 0;
        try (Cursor c = db.rawQuery("SELECT COUNT(*) FROM zhuangzi_content", null)) {
            if (c.moveToFirst()) count = c.getLong(0);
        }
        if (count >= ZHUANGZI_TOTAL_DAYS) return;

        db.beginTransaction();
        try {
            JSONObject root = new JSONObject(readAsset("zhuangzi_seed.json"));
            int version = root.optInt("version", 1);
            JSONArray days = root.getJSONArray("days");
            db.delete("zhuangzi_content", null, null);

            for (int i = 0; i < days.length(); i++) {
                JSONObject o = days.getJSONObject(i);
                ContentValues v = new ContentValues();
                v.put("id", o.getInt("id"));
                v.put("day_no", o.getInt("day_no"));
                v.put("chapter", o.getString("chapter"));
                v.put("title", o.getString("title"));
                v.put("original_text", o.optString("original_text", ""));
                v.put("story", o.getString("story"));
                v.put("interpretation", o.getString("interpretation"));
                v.put("action", o.getString("action"));
                v.put("mood_tags", o.optJSONArray("mood_tags") != null
                        ? o.getJSONArray("mood_tags").toString() : "[]");
                v.put("health_tags", o.optJSONArray("health_tags") != null
                        ? o.getJSONArray("health_tags").toString() : "[]");
                v.put("priority", o.optInt("priority", 0));
                v.put("content_version", version);
                db.insertOrThrow("zhuangzi_content", null, v);
            }

            ContentValues meta = new ContentValues();
            meta.put("key", "zhuangzi_content_version");
            meta.put("value", String.valueOf(version));
            db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

            db.setTransactionSuccessful();
        } catch (Exception e) {
            throw new RuntimeException("Failed to seed Zhuangzi content", e);
        } finally {
            db.endTransaction();
        }
    }

    private void ensureHealthRulesSeeded() {
        SQLiteDatabase db = getWritableDatabase();
        createHealthRuleTables(db);

        String current = getMeta(db, "health_rules_version");
        try {
            JSONObject root = new JSONObject(readAsset("health_rules_seed.json"));
            int version = root.optInt("version", 1);
            if (String.valueOf(version).equals(current)) return;

            db.beginTransaction();
            try {
                db.delete("food_disease_rules", null, null);
                db.delete("evidence", null, null);

                JSONArray evidence = root.getJSONArray("evidence");
                for (int i = 0; i < evidence.length(); i++) {
                    JSONObject o = evidence.getJSONObject(i);
                    ContentValues v = new ContentValues();
                    v.put("id", o.getString("id"));
                    v.put("title", o.getString("title"));
                    v.put("organization", o.getString("organization"));
                    v.put("year", o.getInt("year"));
                    v.put("url", o.getString("url"));
                    v.put("evidence_level", o.getString("level"));
                    v.put("scope", o.getString("scope"));
                    v.put("content_version", version);
                    db.insertOrThrow("evidence", null, v);
                }

                JSONArray rules = root.getJSONArray("rules");
                for (int i = 0; i < rules.length(); i++) {
                    JSONArray row = rules.getJSONArray(i);
                    ContentValues v = new ContentValues();
                    v.put("food_id", row.getString(0));
                    v.put("disease", row.getString(1));
                    v.put("status", row.getString(2));
                    v.put("reason", row.getString(3));
                    v.put("evidence_id", row.getString(4));
                    v.put("content_version", version);
                    db.insertOrThrow("food_disease_rules", null, v);
                }

                ContentValues meta = new ContentValues();
                meta.put("key", "health_rules_version");
                meta.put("value", String.valueOf(version));
                db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);

                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to seed health rules", e);
        }
    }

    private void ensureFoodSeeded() {
        SQLiteDatabase db = getWritableDatabase();
        createFoodTables(db);

        String current = getMeta(db, "food_content_version");
        try {
            JSONObject root = new JSONObject(readAsset("food_core_seed.json"));
            int version = root.optInt("version", 1);
            if (String.valueOf(version).equals(current)) return;

            db.beginTransaction();
            try {
                db.delete("foods", null, null);
                db.delete("food_sources", null, null);

                JSONArray sources = root.getJSONArray("sources");
                for (int i = 0; i < sources.length(); i++) {
                    JSONObject o = sources.getJSONObject(i);
                    ContentValues v = new ContentValues();
                    v.put("id", o.getString("id"));
                    v.put("name", o.getString("name"));
                    v.put("region", o.optString("region", ""));
                    v.put("kind", o.optString("kind", ""));
                    v.put("license_note", o.optString("license_note", ""));
                    v.put("url", o.optString("url", ""));
                    v.put("content_version", version);
                    db.insertOrThrow("food_sources", null, v);
                }

                JSONArray foods = root.getJSONArray("foods");
                for (int i = 0; i < foods.length(); i++) {
                    JSONObject o = foods.getJSONObject(i);
                    ContentValues v = new ContentValues();
                    v.put("id", o.getString("id"));
                    v.put("name", o.getString("name"));
                    v.put("icon", o.optString("icon", ""));
                    v.put("category", o.optString("category", ""));
                    v.put("state", o.optString("state", ""));
                    v.put("basis", o.optString("basis", "每100g"));
                    v.put("kcal", o.optDouble("kcal", 0));
                    v.put("protein", o.optDouble("p", 0));
                    v.put("carbs", o.optDouble("c", 0));
                    v.put("fat", o.optDouble("f", 0));
                    if (!o.isNull("fiber")) v.put("fiber", o.optDouble("fiber", 0));
                    if (!o.isNull("sodium")) v.put("sodium", o.optDouble("sodium", 0));
                    v.put("purine", o.optString("purine", ""));
                    v.put("source_id", o.getString("source_id"));
                    v.put("source_note", o.optString("source_note", ""));
                    v.put("content_version", version);
                    db.insertOrThrow("foods", null, v);
                }

                ContentValues meta = new ContentValues();
                meta.put("key", "food_content_version");
                meta.put("value", String.valueOf(version));
                db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to seed food catalog", e);
        }
    }

    private void ensureStartDate() {
        SQLiteDatabase db = getWritableDatabase();
        String value = getMeta(db, "zhuangzi_start_date");
        if (value == null || value.isEmpty()) {
            ContentValues meta = new ContentValues();
            meta.put("key", "zhuangzi_start_date");
            meta.put("value", today());
            db.insertWithOnConflict("app_meta", null, meta, SQLiteDatabase.CONFLICT_REPLACE);
        }
    }

    private String getMeta(SQLiteDatabase db, String key) {
        try (Cursor c = db.query(
                "app_meta",
                new String[]{"value"},
                "key=?",
                new String[]{key},
                null, null, null)) {
            if (c.moveToFirst()) return c.getString(0);
        }
        return null;
    }

    private int getCurrentDayNumber() {
        SQLiteDatabase db = getReadableDatabase();
        String start = getMeta(db, "zhuangzi_start_date");
        if (start == null || start.isEmpty()) return 1;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setLenient(false);
            Date a = f.parse(start);
            Date b = f.parse(today());
            if (a == null || b == null) return 1;
            long days = Math.max(0, (b.getTime() - a.getTime()) / 86400000L);
            return Math.min(ZHUANGZI_TOTAL_DAYS, (int) days + 1);
        } catch (Exception e) {
            return 1;
        }
    }

    private boolean isCycleComplete() {
        SQLiteDatabase db = getReadableDatabase();
        String start = getMeta(db, "zhuangzi_start_date");
        if (start == null || start.isEmpty()) return false;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date a = f.parse(start);
            Date b = f.parse(today());
            if (a == null || b == null) return false;
            return (b.getTime() - a.getTime()) / 86400000L >= ZHUANGZI_TOTAL_DAYS;
        } catch (Exception e) {
            return false;
        }
    }

    public String getZhuangziDayJson(int dayNo) {
        int safeDay = Math.max(1, Math.min(ZHUANGZI_TOTAL_DAYS, dayNo));
        SQLiteDatabase db = getReadableDatabase();

        try (Cursor c = db.rawQuery(
                "SELECT c.id,c.day_no,c.chapter,c.title,c.original_text,c.story,c.interpretation,c.action," +
                        "c.mood_tags,c.health_tags,c.priority,COALESCE(p.checked,0) " +
                        "FROM zhuangzi_content c LEFT JOIN zhuangzi_progress p ON c.day_no=p.day_no " +
                        "WHERE c.day_no=? LIMIT 1",
                new String[]{String.valueOf(safeDay)})) {

            if (!c.moveToFirst()) return "{}";

            JSONObject o = new JSONObject();
            o.put("id", c.getInt(0));
            o.put("day_no", c.getInt(1));
            o.put("chapter", c.getString(2));
            o.put("title", c.getString(3));
            o.put("original_text", c.getString(4));
            o.put("story", c.getString(5));
            o.put("interpretation", c.getString(6));
            o.put("action", c.getString(7));
            o.put("mood_tags", new JSONArray(c.getString(8)));
            o.put("health_tags", new JSONArray(c.getString(9)));
            o.put("priority", c.getInt(10));
            o.put("checked", c.getInt(11) == 1);
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    public String getZhuangziStatusJson() {
        SQLiteDatabase db = getReadableDatabase();
        int checkedCount = 0;
        try (Cursor c = db.rawQuery(
                "SELECT COUNT(*) FROM zhuangzi_progress WHERE checked=1",
                null)) {
            if (c.moveToFirst()) checkedCount = c.getInt(0);
        }

        int currentDay = getCurrentDayNumber();
        JSONObject out = new JSONObject();
        try {
            out.put("current_day", currentDay);
            out.put("total_days", ZHUANGZI_TOTAL_DAYS);
            out.put("checked_count", checkedCount);
            out.put("cycle_complete", isCycleComplete());
            out.put("start_date", getMeta(db, "zhuangzi_start_date"));
            out.put("content_version", getMeta(db, "zhuangzi_content_version"));
            out.put("current", new JSONObject(getZhuangziDayJson(currentDay)));
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public boolean setZhuangziCheckin(int dayNo, boolean checked) {
        int safeDay = Math.max(1, Math.min(ZHUANGZI_TOTAL_DAYS, dayNo));
        SQLiteDatabase db = getWritableDatabase();

        ContentValues v = new ContentValues();
        v.put("day_no", safeDay);
        v.put("checked", checked ? 1 : 0);
        v.put("checked_at", checked ? nowIso() : null);

        return db.insertWithOnConflict(
                "zhuangzi_progress",
                null,
                v,
                SQLiteDatabase.CONFLICT_REPLACE
        ) != -1;
    }

    private int severity(String status) {
        if ("red".equals(status)) return 3;
        if ("yellow".equals(status)) return 2;
        if ("green".equals(status)) return 1;
        return 0;
    }

    private JSONObject readFoodRule(SQLiteDatabase db, String foodId, String disease) {
        try (Cursor c = db.rawQuery(
                "SELECT r.status,r.reason,r.evidence_id,e.title,e.organization,e.year,e.url,e.evidence_level " +
                        "FROM food_disease_rules r LEFT JOIN evidence e ON r.evidence_id=e.id " +
                        "WHERE r.food_id=? AND r.disease=? LIMIT 1",
                new String[]{foodId, disease})) {
            if (!c.moveToFirst()) return null;
            JSONObject o = new JSONObject();
            o.put("disease", disease);
            o.put("status", c.getString(0));
            o.put("reason", c.getString(1));
            o.put("evidence_id", c.getString(2));
            JSONObject e = new JSONObject();
            e.put("title", c.getString(3));
            e.put("organization", c.getString(4));
            e.put("year", c.getInt(5));
            e.put("url", c.getString(6));
            e.put("level", c.getString(7));
            o.put("evidence", e);
            return o;
        } catch (Exception e) {
            return null;
        }
    }

    public String getFoodCatalogJson() {
        JSONArray out = new JSONArray();
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.rawQuery(
                "SELECT f.id,f.name,f.icon,f.category,f.state,f.basis,f.kcal,f.protein,f.carbs,f.fat," +
                        "f.fiber,f.sodium,f.purine,f.source_id,f.source_note,s.name,s.region,s.url " +
                        "FROM foods f LEFT JOIN food_sources s ON f.source_id=s.id ORDER BY f.category,f.name",
                null)) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("id", c.getString(0));
                o.put("name", c.getString(1));
                o.put("icon", c.getString(2));
                o.put("category", c.getString(3));
                o.put("state", c.getString(4));
                o.put("basis", c.getString(5));
                o.put("kcal", c.getDouble(6));
                o.put("p", c.getDouble(7));
                o.put("c", c.getDouble(8));
                o.put("f", c.getDouble(9));
                if (!c.isNull(10)) o.put("fiber", c.getDouble(10)); else o.put("fiber", JSONObject.NULL);
                if (!c.isNull(11)) o.put("sodium", c.getDouble(11)); else o.put("sodium", JSONObject.NULL);
                o.put("purine", c.getString(12));
                o.put("source_id", c.getString(13));
                o.put("source_note", c.getString(14));
                o.put("source_name", c.getString(15));
                o.put("source_region", c.getString(16));
                o.put("source_url", c.getString(17));
                out.put(o);
            }
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public void upsertDailySteps(
            String date,
            int steps,
            String source,
            String confidence,
            float rawCounter,
            String bootId) {
        SQLiteDatabase db = getWritableDatabase();
        ContentValues v = new ContentValues();
        v.put("date", date);
        v.put("steps", Math.max(0, steps));
        v.put("source", source == null ? "sensor" : source);
        v.put("confidence", confidence == null ? "estimated" : confidence);
        v.put("raw_counter", rawCounter);
        v.put("boot_id", bootId == null ? "" : bootId);
        v.put("updated_at", nowIso());
        db.insertWithOnConflict("daily_steps", null, v, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public boolean upsertDailyMetricsJson(String json) {
        try {
            JSONObject o = new JSONObject(json == null ? "{}" : json);
            String date = o.optString("date", "");
            if (date.isEmpty()) return false;

            ContentValues v = new ContentValues();
            v.put("date", date);
            v.put("intake_kcal", o.optDouble("intakeKcal", 0));
            v.put("protein_g", o.optDouble("proteinG", 0));
            v.put("carbs_g", o.optDouble("carbsG", 0));
            v.put("fat_g", o.optDouble("fatG", 0));
            v.put("steps", Math.max(0, o.optInt("steps", 0)));
            v.put("activity_kcal", o.optDouble("activityKcal", 0));
            v.put("exercise_min", o.optDouble("exerciseMin", 0));
            v.put("meditation_min", o.optDouble("meditationMin", 0));
            if (o.has("weightKg") && !o.isNull("weightKg")) v.put("weight_kg", o.optDouble("weightKg"));
            v.put("cigarettes", o.optDouble("cigarettes", 0));
            v.put("alcohol_g", o.optDouble("alcoholG", 0));
            v.put("late_hours", o.optDouble("lateHours", 0));
            v.put("red_food_count", Math.max(0, o.optInt("redFoodCount", 0)));
            v.put("updated_at", nowIso());

            return getWritableDatabase().insertWithOnConflict(
                    "daily_metrics", null, v, SQLiteDatabase.CONFLICT_REPLACE) != -1;
        } catch (Exception e) {
            return false;
        }
    }

    public String getDailyMetricsJson(int days) {
        JSONArray out = new JSONArray();
        int limit = Math.max(1, Math.min(days, 366));
        try (Cursor c = getReadableDatabase().rawQuery(
                "SELECT date,intake_kcal,protein_g,carbs_g,fat_g,steps,activity_kcal,exercise_min,meditation_min," +
                        "weight_kg,cigarettes,alcohol_g,late_hours,red_food_count,updated_at " +
                        "FROM daily_metrics ORDER BY date DESC LIMIT ?",
                new String[]{String.valueOf(limit)})) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("date", c.getString(0));
                o.put("intakeKcal", c.getDouble(1));
                o.put("proteinG", c.getDouble(2));
                o.put("carbsG", c.getDouble(3));
                o.put("fatG", c.getDouble(4));
                o.put("steps", c.getInt(5));
                o.put("activityKcal", c.getDouble(6));
                o.put("exerciseMin", c.getDouble(7));
                o.put("meditationMin", c.getDouble(8));
                if (!c.isNull(9)) o.put("weightKg", c.getDouble(9)); else o.put("weightKg", JSONObject.NULL);
                o.put("cigarettes", c.getDouble(10));
                o.put("alcoholG", c.getDouble(11));
                o.put("lateHours", c.getDouble(12));
                o.put("redFoodCount", c.getInt(13));
                o.put("updatedAt", c.getString(14));
                out.put(o);
            }
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public String getStepHistoryJson(int days) {
        JSONArray out = new JSONArray();
        SQLiteDatabase db = getReadableDatabase();
        int limit = Math.max(1, Math.min(days, 366));
        try (Cursor c = db.rawQuery(
                "SELECT date,steps,source,confidence,updated_at FROM daily_steps ORDER BY date DESC LIMIT ?",
                new String[]{String.valueOf(limit)})) {
            while (c.moveToNext()) {
                JSONObject o = new JSONObject();
                o.put("date", c.getString(0));
                o.put("steps", c.getInt(1));
                o.put("source", c.getString(2));
                o.put("confidence", c.getString(3));
                o.put("updated_at", c.getString(4));
                out.put(o);
            }
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public String getVersionAuditJson() {
        JSONObject out = new JSONObject();
        JSONArray history = new JSONArray();
        SQLiteDatabase db = getReadableDatabase();

        try {
            out.put("app_version", appVersion);
            out.put("version_code", versionCode);
            out.put("schema_version", DB_VERSION);
            out.put("rule_version", ruleVersion);
            out.put("content_version", contentVersion);
            out.put("evidence_version", evidenceVersion);
            out.put("git_sha", gitSha);

            try (Cursor c = db.rawQuery(
                    "SELECT app_version,version_code,schema_version,rule_version,content_version,evidence_version,git_sha,installed_at " +
                            "FROM release_audit ORDER BY id DESC LIMIT 20",
                    null)) {
                while (c.moveToNext()) {
                    JSONObject row = new JSONObject();
                    row.put("app_version", c.getString(0));
                    row.put("version_code", c.getInt(1));
                    row.put("schema_version", c.getInt(2));
                    row.put("rule_version", c.getString(3));
                    row.put("content_version", c.getString(4));
                    row.put("evidence_version", c.getString(5));
                    row.put("git_sha", c.getString(6));
                    row.put("installed_at", c.getString(7));
                    history.put(row);
                }
            }
            out.put("history", history);
        } catch (Exception ignored) {
        }
        return out.toString();
    }

    public String evaluateFoodRiskJson(String foodId, String profileJson) {
        JSONObject out = new JSONObject();
        JSONArray items = new JSONArray();
        try {
            JSONObject p = new JSONObject(profileJson == null ? "{}" : profileJson);
            List<String> diseases = new ArrayList<>();
            if (p.optBoolean("gout", false)) diseases.add("gout");
            if (p.optBoolean("diabetes", false)) diseases.add("diabetes");
            if (p.optBoolean("hypertension", false)) diseases.add("hypertension");
            if (p.optBoolean("heartDisease", false) ||
                    p.optBoolean("priorMI", false) ||
                    p.optBoolean("priorStroke", false)) {
                diseases.add("cardiovascular");
            }

            SQLiteDatabase db = getReadableDatabase();
            String worst = "neutral";
            int worstSeverity = 0;

            for (String disease : diseases) {
                JSONObject rule = readFoodRule(db, foodId, disease);
                if (rule == null) continue;
                items.put(rule);
                int s = severity(rule.optString("status", "neutral"));
                if (s > worstSeverity) {
                    worstSeverity = s;
                    worst = rule.optString("status", "neutral");
                }
            }

            out.put("food_id", foodId);
            out.put("status", worst);
            out.put("items", items);
            out.put("has_rules", items.length() > 0);
            out.put("rules_version", getMeta(db, "health_rules_version"));
        } catch (Exception ignored) {
        }
        return out.toString();
    }
}
