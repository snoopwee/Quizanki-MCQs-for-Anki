import type { CatalogueOf } from "@/lib/i18n/translate";
import type { en } from "@/lib/i18n/messages/en";

/**
 * Vietnamese.
 *
 * <p>Typed as `CatalogueOf<typeof en>`, so adding a key to English and forgetting it here is a
 * **typecheck failure**. That is the guard that keeps a half-translated screen from shipping.
 *
 * <p>Terminology settled once, so it stays consistent across screens:
 * <ul>
 *   <li>deck → <b>bộ thẻ</b> (not "bộ bài", which is a pack of playing cards)</li>
 *   <li>card → <b>thẻ</b></li>
 *   <li>quiz → <b>bài trắc nghiệm</b> — the established school word for multiple choice</li>
 *   <li>flashcard → <b>thẻ ghi nhớ</b></li>
 *   <li>sign up / log in → <b>đăng ký</b> / <b>đăng nhập</b></li>
 * </ul>
 *
 * <p>No plural forms anywhere: Vietnamese nouns do not inflect for number, so "1 thẻ" and "8 thẻ"
 * are the same word. `translate` allows a plain string where English needs `{one, other}`.
 */
export const vi = {
  // ---- shared ----------------------------------------------------------------------------
  "common.logIn": "Đăng nhập",
  "common.signUp": "Đăng ký",
  "common.home": "Trang chủ →",
  "common.browseDecks": "Khám phá bộ thẻ",
  "common.close": "Đóng",
  "common.or": "hoặc",
  "common.privacy": "Quyền riêng tư",
  "common.terms": "Điều khoản",

  // ---- landing ---------------------------------------------------------------------------
  "landing.eyebrow": "Bộ thẻ Anki → trắc nghiệm",
  "landing.headline": "Học bộ thẻ Anki của bạn",
  "landing.headlineAccent": "dưới dạng trắc nghiệm.",
  "landing.lede":
    "Tải lên một tệp .apkg — hoặc mở bộ thẻ ai đó đã chia sẻ — và bắt đầu bài trắc nghiệm chỉ trong vài giây. Mỗi bộ thẻ đều có một lượt làm miễn phí, không cần tài khoản. Đăng ký để làm không giới hạn, tự chọn dạng câu hỏi và lưu lại tiến độ.",
  "landing.feature.fields": "Tự động nhận diện các trường",
  "landing.feature.flashcards": "Chế độ học thẻ ghi nhớ",
  "landing.feature.distractors": "Đáp án nhiễu lấy từ chính bộ thẻ của bạn",
  "landing.uploaderFootnote":
    "Đọc toàn bộ thẻ và làm một bài trắc nghiệm miễn phí — không cần đăng ký.",
  "landing.footerTagline": "— bộ thẻ Anki của bạn, dưới dạng trắc nghiệm.",

  "landing.saveTitle": "Lưu bộ thẻ của bạn",
  "landing.saveDescription":
    "Tuyệt! Hãy tạo tài khoản (hoặc đăng nhập) để xem lại bộ thẻ này và lưu vào thư viện của bạn.",
  "landing.saveLogIn": "Đăng nhập & tiếp tục",
  "landing.saveSignUp": "Đăng ký & tiếp tục",
  "landing.saveConfirmNotice":
    "Đã tạo tài khoản, và bộ thẻ của bạn đã được lưu trong trình duyệt này. Hãy xác nhận email — nhớ xem cả thư mục spam — rồi đăng nhập, chúng tôi sẽ tiếp tục từ chỗ bạn dừng lại.",

  // ---- auth modal ------------------------------------------------------------------------
  "auth.welcomeBack": "Chào mừng trở lại",
  "auth.createAccount": "Tạo tài khoản",
  "auth.resetHeading": "Đặt lại mật khẩu",
  "auth.continueWithGoogle": "Tiếp tục với Google",
  "auth.email": "Email",
  "auth.password": "Mật khẩu",
  "auth.username": "Tên người dùng",
  "auth.usernameHint": "Bạn có thể đổi sau.",
  "auth.emailPlaceholder": "ban@example.com",
  "auth.forgotPassword": "Quên mật khẩu?",
  "auth.backToLogIn": "← Quay lại đăng nhập",
  "auth.sendResetLink": "Gửi liên kết đặt lại",
  "auth.resetExplainer":
    "Nhập địa chỉ email bạn đã đăng ký, chúng tôi sẽ gửi liên kết để bạn đặt mật khẩu mới.",
  "auth.working": "Chờ một chút…",
  "auth.genericError": "Đã có lỗi xảy ra. Vui lòng thử lại.",

  // Reordered deliberately: Vietnamese leads with the condition, so the sentence reads
  // "Khi tiếp tục, bạn đồng ý với [điều khoản] và [chính sách quyền riêng tư] của chúng tôi."
  "auth.legalTermsLink": "điều khoản",
  "auth.legalPrivacyLink": "chính sách quyền riêng tư",
  "auth.legalPrefix": "Khi tiếp tục, bạn đồng ý với",
  "auth.legalMiddle": "và",
  "auth.legalSuffix": " của chúng tôi. Không bao giờ có thư rác.",

  // ⚠ Says nothing about whether the address is registered — see the English note. Do not add
  // "nếu bạn đã đăng ký" or anything like it.
  "auth.resetSent":
    "Nếu địa chỉ đó có tài khoản, liên kết đặt lại đang được gửi đi. Hãy kiểm tra hộp thư và cả thư mục spam.",

  "auth.confirmEmail":
    "Đã tạo tài khoản. Hãy kiểm tra hộp thư để tìm liên kết xác nhận — nhớ xem cả thư mục spam — rồi đăng nhập.",

  // ---- settings --------------------------------------------------------------------------
  "settings.language": "Ngôn ngữ",
  "settings.languageHint": "Áp dụng cho giao diện. Bộ thẻ của bạn không bao giờ bị dịch.",
} as const satisfies CatalogueOf<typeof en>;
