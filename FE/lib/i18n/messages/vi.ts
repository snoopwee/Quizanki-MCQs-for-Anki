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

  // ---- uploading a deck -------------------------------------------------------------------
  "uploader.heading": "Nhập từ tệp .apkg",
  "uploader.dropzone": "Kéo tệp .apkg vào đây, hoặc bấm để chọn",
  "uploader.dropzoneHint": "Tệp xuất từ Anki · tối đa 50 MB",
  "uploader.reading": "Đang đọc bộ thẻ của bạn…",
  "uploader.continue": "Tiếp tục →",
  "uploader.wrongType": "Vui lòng chọn tệp .apkg (tệp xuất bộ thẻ từ Anki).",
  "uploader.parseFailed": "Không đọc được tệp này. Hãy thử một tệp .apkg khác.",
  "uploader.nothingQuizzable": "Chưa có loại ghi chú nào trong tệp này phù hợp để tạo trắc nghiệm.",
  "uploader.needDeck": "Chưa có bộ thẻ?",
  "uploader.browseShared": "Xem các bộ thẻ được chia sẻ tại đây",

  // ---- quiz --------------------------------------------------------------------------------
  "quiz.endQuiz": "Kết thúc",
  "quiz.settings": "Cài đặt trắc nghiệm",
  "quiz.typeMultipleChoice": "Trắc nghiệm",
  "quiz.typeTrueFalse": "Đúng / sai",
  "quiz.explainAsk": "Vì sao đây là đáp án?",
  "quiz.explainThinking": "Đang nghĩ…",

  // ---- results -----------------------------------------------------------------------------
  "results.complete": "Hoàn thành bài trắc nghiệm",
  "results.praiseGreat": "Làm tốt lắm",
  "results.praiseKeepGoing": "Cố lên nhé",
  "results.praiseAnotherPass": "Nên ôn lại một lượt",
  "results.newQuiz": "Bài mới",
  "results.retryMissed": "Làm lại câu sai",
  "results.reviewAnswers": "Xem lại đáp án",

  "uploader.tooLarge": "Tệp quá lớn (giới hạn {limit} MB).",
  "quiz.typeWritten": "Tự luận",
  "quiz.mixedFormats": "nhiều dạng",
  "results.praiseOutstanding": "Xuất sắc",
  "results.correct": "Đúng",
  "results.incorrect": "Sai",
  "results.accuracy": "Độ chính xác",
  "results.retake": "Làm lại",
  "results.missed": "Chưa đúng",

  // ---- quiz setup ---------------------------------------------------------------------------
  "setup.heading": "Tạo bài trắc nghiệm",
  "setup.headingYour": "Thiết lập bài trắc nghiệm",
  "setup.start": "Bắt đầu",
  "setup.howMany": "Bao nhiêu câu hỏi?",
  "setup.numberOfQuestions": "Số câu hỏi",
  "setup.questionTypes": "Dạng câu hỏi",
  "setup.questionTypesDesc": "Kết hợp tuỳ ý — mỗi thẻ sẽ được hỏi theo một trong các dạng đang bật.",
  "setup.pullFrom": "Lấy thẻ từ",
  "setup.allCards": "Tất cả thẻ",
  "setup.stillLearning": "Đang học",
  "setup.clozeNoteTypes": "Loại ghi chú điền khuyết",
  "setup.pickAField": "Hãy chọn ít nhất một trường câu hỏi cho mỗi loại ghi chú bạn muốn dùng.",
  "setup.fieldsHeading": "Trường câu hỏi và đáp án",
  "setup.prefilled": "Điền sẵn theo bố cục thẻ của bộ thẻ — chỉnh lại nếu cần.",
  "setup.detectionUnsure": "Chưa chắc chắn — hãy kiểm tra lại trường câu hỏi và đáp án.",
  "setup.questionLegend": "Câu hỏi — hiển thị trên thẻ",
  "setup.questionHint": "Chọn một hoặc nhiều trường để gộp vào mỗi câu hỏi.",
  "setup.answerLabel": "Đáp án — lựa chọn đúng",

  // ---- flashcards ----------------------------------------------------------------------------
  "study.allMastery": "Mọi mức thành thạo",
  "study.new": "Mới",
  "study.learning": "Đang học",
  "study.practicing": "Đang luyện",
  "study.mastered": "Đã thuộc",
  "study.front": "Mặt trước",
  "study.back": "Mặt sau",
  "study.clickToFlip": "Bấm để lật",
  "study.flipCard": "Lật thẻ",
  "study.editCard": "Sửa thẻ",
  "study.editFields": "Sửa các trường",
  "study.know": "Đã thuộc",
  "study.stillLearning": "Chưa thuộc",
  "study.gotIt": "Đã hiểu",
  "study.roundComplete": "Xong một lượt",
  "study.youKnew": "Bạn thuộc {known}/{total}",
  "study.knownCount": "{count} đã thuộc",
  "study.previousCard": "Thẻ trước",
  "study.nextCard": "Thẻ sau",
  "study.autoplay": "Tự động chạy",
  "study.pauseAutoplay": "Tạm dừng tự động",
  "study.shuffle": "Xáo thẻ",
  "study.shuffleOn": "Đang xáo thẻ",
  "study.flashcardsOptions": "Tuỳ chọn thẻ ghi nhớ",
  "study.focusMode": "Chế độ tập trung",
  "study.exitFullscreen": "Thoát toàn màn hình",
  "study.exitFullscreenEsc": "Thoát toàn màn hình (Esc)",
  "study.searchPlaceholder": "Tìm thuật ngữ hoặc định nghĩa…",
  "study.searchCards": "Tìm thẻ",
  "study.clearSearch": "Xoá tìm kiếm",
  "study.filterByMastery": "Lọc theo mức thành thạo",
  "study.cardSorting": "Phân loại thẻ",
  "study.exitSorting": "Thoát phân loại",
  "study.studying": "Đang học",
  "study.showAll": "Xem tất cả",
  "study.showAllCount": "Xem tất cả ({count})",
  "study.showMore": "Xem thêm",
  "study.deckCompletion": "Mức hoàn thành bộ thẻ",
  "study.saveDeck": "Lưu bộ thẻ",
  "study.importAnother": "Nhập bộ thẻ khác",
  "study.setUpQuiz": "Tạo bài trắc nghiệm →",
  "study.keysHint": "Phím:",
  "study.restart": "Bắt đầu lại",
  "study.subsetStarred": "Đã gắn sao",
  // One form only: Vietnamese nouns do not inflect for number.
  "study.cardCount": "{count} thẻ",
  "study.deckIntro": "{count} thẻ — học xong rồi tạo bài trắc nghiệm.",

  "study.cardsInDeck": "Thẻ trong bộ này ({shown})",
  "study.cardsInDeckFiltered": "Thẻ trong bộ này ({shown}/{total})",
  "landing.startOver": "Bắt đầu lại",
  "landing.signUpToQuizAgain": "Đăng ký để làm tiếp →",
  "landing.startFreeQuiz": "Làm bài trắc nghiệm miễn phí →",
  "landing.backToFlashcards": "Quay lại thẻ ghi nhớ",
  "common.cancel": "Huỷ",

  "study.keyPrev": "trước",
  "study.keyNext": "sau",
  "study.keyFlip": "lật",
  "study.keyFocus": "tập trung",

  // ---- app shell / navigation -----------------------------------------------------------------
  "nav.home": "Trang chủ",
  "nav.discover": "Khám phá",
  "nav.folders": "Thư mục",
  "nav.importDeck": "Nhập bộ thẻ",
  "nav.makeQuizDeck": "Tạo bộ thẻ trắc nghiệm",
  "nav.newDeck": "Bộ thẻ mới",
  "nav.admin": "Quản trị",
  "nav.openMenu": "Mở menu",
  "nav.closeMenu": "Đóng menu",
  "nav.pinSidebar": "Ghim thanh bên",
  "nav.hoverMode": "Chuyển sang chế độ di chuột",
  "nav.savingDeck": "Đang lưu bộ thẻ",
  "nav.savingDeckEllipsis": "Đang lưu bộ thẻ…",
  "nav.comingSoon": "Sắp có",

  // ---- home ---------------------------------------------------------------------------------
  "home.welcome": "Chào mừng trở lại",
  "home.subtitle": "Tiếp tục từ chỗ bạn dừng lại.",
  "home.avgCompletion": "Hoàn thành trung bình",
  "home.quickActions": "Thao tác nhanh",
  "home.importTitle": "Nhập một bộ thẻ Anki",
  "home.importDesc": "Tải lên tệp .apkg, chúng tôi sẽ biến mọi thẻ thành câu hỏi trắc nghiệm.",
  "home.quickQuizTitle": "Làm nhanh một bài",
  "home.quizThisDeck": "Làm bài với bộ thẻ này",
  "home.newQuiz": "Bài mới",
  "home.exploreTitle": "Khám phá bộ thẻ được chia sẻ",
  "home.exploreDesc": "Xem các bộ thẻ do người học khác chia sẻ — tiếng Nhật, tiếng Tây Ban Nha và nhiều hơn nữa.",
  "home.browseDiscover": "Đến trang Khám phá",
  "home.yourDecks": "Bộ thẻ của bạn",
  "home.tabSaved": "Đã lưu",
  "home.tabRecent": "Gần đây",
  "home.noDecks": "Chưa có bộ thẻ nào.",
  "home.importFirst": "Nhập bộ thẻ đầu tiên của bạn",
  "home.noSaved": "Chưa lưu bộ thẻ nào.",
  "home.noSavedHint": "Mở một bộ thẻ được chia sẻ rồi bấm \u201cLưu về Trang chủ\u201d để giữ lại đây.",
  "home.nothingRecent": "Chưa có gì gần đây.",
  "home.nothingRecentHint": "Bộ thẻ bạn mở sẽ xuất hiện ở đây trong 30 ngày.",

  "home.decks": "Bộ thẻ",
  "home.cardsTotal": "tổng {count} thẻ",
  "home.acrossYourDecks": "trên tất cả bộ thẻ của bạn",
  "home.studyStreak": "Chuỗi ngày học",
  "home.streakDays": "{count} ngày",
  "home.streakBest": "kỷ lục {count}",
  "home.streakError": "Không tải được chuỗi ngày học",
  "home.last7Days": "7 ngày gần đây",
  "home.studyDaysAria": "Những ngày bạn đã học trong 7 ngày gần đây",
  "home.today": "Hôm nay",
  "home.studied": "đã học",
  "home.notStudied": "chưa học",
  "streak.doneToday": "Xong hôm nay",
  "streak.studyToday": "Học hôm nay",
  "streak.startToday": "Bắt đầu hôm nay",

  "home.quickQuizFrom": "Bài trắc nghiệm từ {deck}.",
  "home.quickQuizNoDeck": "Hãy nhập một bộ thẻ trước, rồi vào thẳng bài trắc nghiệm.",

  // ---- deck card / rating -----------------------------------------------------------------
  "deck.loading": "Đang tải…",
  "deck.loadFailed": "Không tải được bộ thẻ.",
  "deck.cardCount": "{count} thẻ",
  "deck.by": "của",
  "deck.createdOn": "Tạo ngày {date}",
  "deck.originalBy": "Bộ thẻ gốc của {name}",
  "rating.notRated": "Chưa có đánh giá",
  "rating.count": "{count} đánh giá",
  "rating.aria": "Được đánh giá {score} trên {max}, {caption}",

  // ---- discover -------------------------------------------------------------------------------
  "discover.metaTitle": "Khám phá bộ thẻ được chia sẻ",
  "discover.metaDescription":
    "Các bộ thẻ Anki công khai do cộng đồng Quizanki chia sẻ — học dưới dạng trắc nghiệm, thẻ ghi nhớ hoặc trò ghép thẻ.",
  "discover.heading": "Khám phá bộ thẻ",
  "discover.lede":
    "Các bộ thẻ mọi người đã chia sẻ. Mở một bộ để xem trước, rồi lưu bản sao của riêng bạn — bạn sẽ có thẻ riêng và tiến độ riêng.",
  "discover.searchLabel": "Tìm bộ thẻ được chia sẻ",
  "discover.searchPlaceholder": "Tìm bộ thẻ được chia sẻ…",
  "discover.size": "Kích thước",
  "discover.sort": "Sắp xếp",
  "discover.sortNewest": "Mới nhất",
  "discover.sortBestRated": "Đánh giá cao nhất",
  "discover.loading": "Đang tải bộ thẻ…",
  "discover.loadFailed": "Không tải được bộ thẻ được chia sẻ. Vui lòng thử lại.",
  "discover.noMatch": "Không có bộ thẻ nào khớp với bộ lọc của bạn.",
  "discover.noneShared": "Chưa có bộ thẻ nào được chia sẻ.",
  "discover.noMatchHint": "Hãy thử tìm rộng hơn hoặc chọn kích thước khác.",
  "discover.noneSharedHint": "Nhập một bộ thẻ của bạn và đặt ở chế độ công khai — nó sẽ xuất hiện ở đây.",
  "discover.prev": "Trước",
  "discover.next": "Sau",
  "size.any": "Mọi kích thước",
  "size.under20": "Dưới 20",
  "size.20to50": "20\u201350",
  "size.50to100": "50\u2013100",
  "size.100plus": "100+",

  // ---- settings --------------------------------------------------------------------------
  "settings.language": "Ngôn ngữ",
  "settings.languageHint": "Áp dụng cho giao diện. Bộ thẻ của bạn không bao giờ bị dịch.",
} as const satisfies CatalogueOf<typeof en>;
