package com.ankiquiz.service;

import com.ankiquiz.entity.MediaObject;
import com.ankiquiz.repository.MediaObjectRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * The content-addressed media registry: the single place that turns bytes into a
 * SHA-256 key, checks whether a blob is already stored, records a newly-stored one,
 * and builds a public URL for a (bucket, hash). Card images and audio both route
 * their dedup through here, and the {@code /me/media/exists} pre-check reads it so
 * the client never re-sends a blob storage already has.
 *
 * <p>Deliberately no refcount: recording is idempotent and reclamation is an
 * out-of-band orphan sweep, so the write path stays free of hot-row contention.
 */
@Service
public class MediaObjectService {

    private final MediaObjectRepository repo;
    private final String supabaseUrl;

    public MediaObjectService(MediaObjectRepository repo,
                              @Value("${supabase.url:}") String supabaseUrl) {
        this.repo = repo;
        this.supabaseUrl = supabaseUrl;
    }

    /** Lowercase SHA-256 hex of the bytes — the content-address key. */
    public static String sha256Hex(byte[] bytes) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16));
                sb.append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandated on every JVM; this can't happen.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /** Whether a blob with this hash is already stored. */
    public boolean exists(String hash) {
        return repo.existsById(hash);
    }

    /** Existing objects among these hashes, as hash → public URL (missing omitted). */
    public Map<String, String> existing(Collection<String> hashes) {
        Map<String, String> out = new HashMap<>();
        for (MediaObject o : repo.findAllById(hashes)) {
            out.put(o.getHash(), publicUrl(o.getBucket(), o.getHash()));
        }
        return out;
    }

    /**
     * Record a newly-stored object. Idempotent: a row that already exists (incl. a
     * concurrent insert that wins the race) is left as-is, never an error.
     */
    public void record(String hash, String bucket, String contentType, long byteSize) {
        if (repo.existsById(hash)) {
            return;
        }
        MediaObject o = new MediaObject();
        o.setHash(hash);
        o.setBucket(bucket);
        o.setContentType(contentType);
        o.setByteSize(byteSize);
        o.setCreatedAt(OffsetDateTime.now());
        try {
            repo.save(o);
        } catch (DataIntegrityViolationException raced) {
            // Another thread inserted the same hash first — that's the desired end state.
        }
    }

    /** Public URL of a content-addressed object. */
    public String publicUrl(String bucket, String hash) {
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + hash;
    }
}
