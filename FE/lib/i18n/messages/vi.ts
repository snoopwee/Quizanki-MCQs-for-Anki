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

  // ---- deck page ------------------------------------------------------------------------------
  "deckPage.loading": "Đang tải bộ thẻ…",
  "deckPage.notFound": "Không tìm thấy bộ thẻ.",
  "deckPage.backToDecks": "Quay lại danh sách bộ thẻ",
  "deckPage.backToFlashcards": "Quay lại thẻ ghi nhớ",
  "deckPage.breadcrumb": "Đường dẫn",
  "deckPage.studyModes": "Cách học",
  "deckPage.flashcards": "Thẻ ghi nhớ",
  "deckPage.flashcardsDesc": "Lật qua từng thẻ bên dưới",
  "deckPage.quizMe": "Kiểm tra tôi",
  "deckPage.quizMeDesc": "Kiểm tra tôi — Trắc nghiệm",
  "deckPage.match": "Ghép thẻ",
  "deckPage.practiceTest": "Bài kiểm tra thử",
  "deckPage.setUpQuiz": "Thiết lập bài trắc nghiệm",
  "deckPage.term": "Thuật ngữ",
  "deckPage.definition": "Định nghĩa",
  "deckPage.edit": "Sửa",
  "deckPage.duplicate": "Nhân bản",
  "deckPage.export": "Xuất",
  "deckPage.delete": "Xoá",
  "deckPage.deleteDeck": "Xoá bộ thẻ",
  "deckPage.deleteConfirm": "Xoá bộ thẻ này?",
  "deckPage.privateShare": "Riêng tư — chia sẻ bộ thẻ này",
  "deckPage.saveToHome": "Lưu về Trang chủ",
  "deckPage.savedToHome": "Đã lưu về Trang chủ — bỏ lưu",
  "deckPage.yourRating": "Đánh giá của bạn",
  "deckPage.deleting": "Đang xoá…",
  "deckPage.rateIt": "Đánh giá",
  "deckPage.report": "Báo cáo",

  // ---- shared deck ----------------------------------------------------------------------------
  "shared.heading": "Bộ thẻ được chia sẻ",
  "shared.notShared": "Bộ thẻ này chưa được chia sẻ",
  "shared.backToDeck": "Quay lại bộ thẻ",
  "shared.cardsInDeck": "Thẻ trong bộ này",
  "shared.studyThisDeck": "Học bộ thẻ này",
  "shared.playMatch": "Chơi Ghép thẻ",
  "shared.startFreeQuiz": "Làm bài trắc nghiệm miễn phí →",
  "shared.keepProgress": "Làm tốt lắm — hãy giữ lại tiến độ này",
  "shared.tryQuizanki": "Dùng thử Quizanki",
  "shared.createOneFree": "Tạo tài khoản miễn phí",

  // ---- folders ---------------------------------------------------------------------------------
  "folders.heading": "Thư mục",
  "folders.allYourDecks": "Tất cả bộ thẻ của bạn",
  "folders.allFolders": "Tất cả thư mục",
  "folders.pickADeck": "Chọn một bộ thẻ để xếp vào",
  "folders.gone": "Thư mục đó không còn nữa.",
  "folders.empty": "Thư mục này đang trống.",

  // ---- sign-up prompts on a shared deck -------------------------------------------------------
  "reason.studyDesc": "Tạo tài khoản miễn phí (hoặc đăng nhập) để học bộ thẻ này và lưu lại tiến độ.",
  "reason.againTitle": "Học tiếp bộ thẻ này",
  "reason.againDesc":
    "Mỗi bộ thẻ chỉ có một lượt làm miễn phí. Có tài khoản, bạn được làm không giới hạn, tự chọn dạng câu hỏi và số thẻ, và tiến độ được lưu lại.",
  "reason.finishedDesc":
    "Kết quả lượt này chưa được lưu. Hãy tạo tài khoản miễn phí để giữ lại, học lại bộ thẻ này và tự chọn cách kiểm tra.",
  "reason.matchDesc": "Ghép thẻ dành cho người đã đăng nhập. Tạo tài khoản miễn phí và chỉ mất một chút thời gian.",
  "reason.unquizableTitle": "Bộ thẻ này không tạo được trắc nghiệm",
  "reason.unquizableDesc":
    "Các thẻ chưa có cặp câu hỏi và đáp án để dựng câu hỏi. Bạn vẫn có thể đọc chúng ở chế độ thẻ ghi nhớ, hoặc đăng ký để mang bộ thẻ của riêng bạn vào.",

  "setup.availableAll": "{count} thẻ trong bộ này — nhập số câu hỏi bạn muốn.",
  "setup.availableStarred": "{count} thẻ đã gắn sao trong bộ này — nhập số câu hỏi bạn muốn.",
  "setup.availableWeak": "{count} thẻ đang học trong bộ này — nhập số câu hỏi bạn muốn.",
  "setup.cardsInSet": "{count} thẻ trong bộ này",
  "setup.unlockHint": " · hãy gắn sao vài thẻ hoặc trả lời vài câu để mở các bộ lọc",
  "setup.starred": "Đã gắn sao",
  "setup.ready": "Sẵn sàng",
  "setup.back": "Quay lại",
  "setup.questionCount": "{count} câu hỏi",
  "setup.noQuizzable":
    "Không có loại ghi chú nào trong {filename} đủ nội dung để tạo trắc nghiệm. Bộ thẻ chỉ có một trường hoặc chỉ có ảnh thì chưa hỗ trợ.",

  // ---- settings --------------------------------------------------------------------------
  "settings.language": "Ngôn ngữ",
  "settings.languageHint": "Áp dụng cho giao diện. Bộ thẻ của bạn không bao giờ bị dịch.",
  "settings.heading": "Cài đặt",
  "settings.lede": "Hiển thị, bảo mật tài khoản và nhiều hơn nữa.",

  "settings.appearance": "Hiển thị",
  "settings.appearanceDesc": "Chọn cách Quizanki hiển thị trên thiết bị này.",
  "settings.followingSystemLight":
    "Đang theo giao diện hệ thống — hiện tại là sáng.",
  "settings.followingSystemDark":
    "Đang theo giao diện hệ thống — hiện tại là tối.",
  "settings.theme": "Giao diện",
  "settings.themeLight": "Sáng",
  "settings.themeDark": "Tối",
  "settings.themeSystem": "Hệ thống",
  "settings.textSize": "Cỡ chữ",
  "settings.textSizeHint": "Kéo để tăng cỡ chữ cho toàn bộ ứng dụng.",
  "settings.savedThisBrowser": "Chỉ lưu trên trình duyệt này.",

  "settings.notifications": "Thông báo",
  "settings.notificationsDesc":
    "Những gì xuất hiện ở biểu tượng chuông. Thông báo từ chúng tôi luôn được gửi đến.",
  "settings.notificationsLoadFailed": "Không tải được cài đặt thông báo của bạn.",

  "settings.ai": "Tạo bằng AI",
  "settings.aiDesc":
    "Biến ghi chú hoặc tệp PDF thành bản nháp bộ thẻ. Thêm khoá API của riêng bạn để có hạn mức mỗi ngày lớn hơn và giữ tài liệu trên tài khoản nhà cung cấp của bạn.",
  "settings.aiLoadFailed": "Không tải được cài đặt AI của bạn.",
  "settings.aiUnsupported":
    "Máy chủ này không được thiết lập để lưu khoá API cá nhân, nên việc tạo bằng AI chỉ dùng hạn mức miễn phí dùng chung.",
  "settings.aiKeyInUse": "Đang dùng khoá của riêng bạn",
  "settings.aiReplaceKey": "Thay khoá API của bạn",
  "settings.aiYourKey": "Khoá API Gemini của bạn",
  "settings.aiKeyPlaceholder": "Dán khoá của bạn",
  "settings.aiSaveKey": "Lưu khoá",
  "settings.aiKeyStored":
    "Được lưu ở dạng mã hoá. Khoá không bao giờ trở lại trang này và chỉ được dùng trên máy chủ để tạo thẻ cho bạn.",

  "settings.password": "Mật khẩu",
  "settings.passwordDesc": "Đặt mật khẩu mới. Bạn vẫn đăng nhập trên thiết bị này.",
  "settings.newPassword": "Mật khẩu mới",
  "settings.confirmPassword": "Xác nhận mật khẩu mới",
  "settings.passwordPlaceholder": "Ít nhất {count} ký tự",
  "settings.confirmPlaceholder": "Nhập lại mật khẩu",
  "settings.updating": "Đang cập nhật…",
  "settings.updatePassword": "Cập nhật mật khẩu",
  "settings.passwordUpdated": "Đã cập nhật mật khẩu.",
  "settings.passwordUpdateFailed": "Không cập nhật được mật khẩu của bạn.",

  "settings.account": "Tài khoản",
  "settings.accountDesc":
    "Đăng xuất khỏi thiết bị này, hoặc xoá tài khoản cùng toàn bộ bộ thẻ.",
  "settings.deleteAccount": "Xoá tài khoản",
  "settings.deleteAccountDesc":
    "Xoá vĩnh viễn tài khoản của bạn và mọi bộ thẻ. Chưa khả dụng — sắp có.",

  // ---- notification kinds -----------------------------------------------------------------
  "notifKind.newFollower": "Người theo dõi mới",
  "notifKind.newFollowerDesc": "Khi có người bắt đầu theo dõi bạn.",
  "notifKind.authorPublished": "Bộ thẻ mới từ tác giả bạn theo dõi",
  "notifKind.authorPublishedDesc": "Khi người bạn theo dõi đăng một bộ thẻ.",
  "notifKind.deckShared": "Bộ thẻ được chia sẻ với bạn",
  "notifKind.deckSharedDesc": "Khi có người gửi trực tiếp một bộ thẻ cho bạn.",
  "notifKind.deckReviewed": "Phản hồi về bộ thẻ của bạn",
  "notifKind.deckReviewedDesc":
    "Khi có người để lại ghi chú kèm đánh giá. Chỉ bạn đọc được những ghi chú đó.",

  // ---- AI errors --------------------------------------------------------------------------
  "aiError.quota":
    "Bạn đã dùng hết lượt tạo bằng AI hôm nay. Hãy thử lại vào ngày mai.",
  "aiError.unavailable": "Tính năng tạo bằng AI hiện không khả dụng.",
  "aiError.tooLarge": "Tệp đó quá lớn.",
  "aiError.offline":
    "Không kết nối được tới máy chủ. Hãy kiểm tra kết nối và thử lại.",
  "aiError.generic":
    "Không tạo được thẻ từ tài liệu đó. Hãy thử tài liệu khác.",

  // ---- password rules ---------------------------------------------------------------------
  "auth.passwordTooShort": "Mật khẩu phải có ít nhất {count} ký tự.",
  "auth.passwordsDontMatch": "Hai mật khẩu không khớp.",

  // ---- shared words -----------------------------------------------------------------------
  "common.loading": "Đang tải…",
  "common.reset": "Đặt lại",
  "common.remove": "Xoá bỏ",
  "common.soon": "Sắp có",
  "common.signOut": "Đăng xuất",
  // ---- app shell (on every signed-in page) ------------------------------------------------
  "shell.accountMenu": "Menu tài khoản",
  "shell.accountFallback": "Tài khoản",
  "shell.profile": "Trang cá nhân",
  "shell.settings": "Cài đặt",
  "shell.notifications": "Thông báo",
  "search.label": "Tìm bộ thẻ của bạn",
  "search.placeholder": "Tìm bộ thẻ của bạn…",
  "search.noMatch": "Không có bộ thẻ nào khớp với “{query}”.",
  "search.empty": "Bạn chưa có bộ thẻ nào.",
  "shell.notificationsUnread": "Thông báo, {count} chưa đọc",
  // ---- /import (the on-ramp) ----------------------------------------------------------------
  "import.preparingTitle": "Đang chuẩn bị bộ thẻ của bạn…",
  "import.preparingHint": "Đang sắp xếp các thẻ để bạn xem lại.",

  "import.tabFile": "Tải lên .apkg",
  "import.tabText": "Dán văn bản",
  "import.tabAi": "Tạo bằng AI",
  "import.tabScratch": "Tạo từ đầu",

  "import.resumeTitle": "Bạn có một bộ thẻ chưa lưu",
  "import.resumeMeta": "{name} · {count} thẻ · đã sửa {age}",
  "import.resume": "Tiếp tục",

  "import.untitledDeck": "Bộ thẻ chưa đặt tên",
  "import.importedSet": "Bộ thẻ đã nhập",

  "import.scratchHeading": "Tạo bộ thẻ từ đầu",
  "import.scratchLede":
    "Bắt đầu với vài thẻ trống rồi tự điền thuật ngữ, định nghĩa cùng ảnh hoặc âm thanh nếu muốn — sau đó lưu như mọi bộ thẻ khác.",
  "import.scratchStart": "Bắt đầu bộ thẻ trống",

  "import.pasteHeading": "Nhập từ văn bản thuần",
  "import.pasteLede":
    "Dán thẻ theo kiểu Quizlet — mỗi dòng một thẻ, thuật ngữ và định nghĩa cách nhau bằng ký tự bạn chọn. Mỗi dòng thành một thẻ Basic (mặt trước/mặt sau).",
  "import.deckName": "Tên bộ thẻ",
  "import.betweenTermDef": "Giữa thuật ngữ và định nghĩa:",
  "import.betweenRows": "Giữa các dòng:",
  "import.delimTab": "Tab",
  "import.delimComma": "Dấu phẩy",
  "import.delimNewline": "Dòng mới",
  "import.delimSemicolon": "Dấu chấm phẩy",
  "import.detected": "Đã nhận ra {count} thẻ",
  "import.reviewCount": "Xem lại {count} thẻ",
  "import.reviewCards": "Xem lại các thẻ",

  // ---- how old an unsaved draft is ------------------------------------------------------------
  "age.justNow": "vừa xong",
  "age.minutes": "{count} phút trước",
  "age.hours": "{count} giờ trước",
  "age.days": "{count} ngày trước",
  "common.discard": "Huỷ bỏ",
  "import.pastePlaceholder": "thuật ngữ\tđịnh nghĩa\nthuật ngữ\tđịnh nghĩa",
  "uploader.lede":
    "Tải lên tệp xuất từ Anki (.apkg). Thẻ, hình ảnh và phát âm đều được mang sang.",
  "uploader.dropzoneHintLimit": "Tệp xuất từ Anki · tối đa {limit} MB",
  "uploader.tooLargeFile": "Bộ thẻ đó nặng {size} MB — giới hạn là {limit} MB.",
  "uploader.studyOneNow": "— học ngay, không cần tệp nào.",
  "uploader.orGrabFrom": "Hoặc tải một tệp .apkg từ",
  "uploader.andUploadAbove": "rồi tải lên ở trên.",
  "uploader.sumNotes": "{count} ghi chú",
  "uploader.sumSkipped": "bỏ qua {count}",
  "uploader.sumOccluded": "loại trừ {count} thẻ che ảnh",
  "uploader.sumAcross": "trên {count} loại ghi chú.",
  "uploader.sumAudio": "{count} thẻ có âm thanh.",
  "uploader.occlusionWarning":
    "Thẻ che ảnh không dùng được cho câu hỏi trắc nghiệm vì không có chữ để hỏi. Đã loại trừ {count} thẻ.",
  "discover.pagerLabel": "Phân trang",
  "discover.pageOf": "Trang {page}/{pages} · {total} bộ thẻ",
  // ---- review before saving -------------------------------------------------------------------
  "review.heading": "Xem lại trước khi lưu",
  "review.swapAll": "Đảo thuật ngữ và định nghĩa cho mọi thẻ",
  "review.swapAllTitle": "Đảo thuật ngữ và định nghĩa của mọi thẻ",
  "review.saving": "Đang lưu…",
  "review.saveDeck": "Lưu bộ thẻ",
  "review.notSavedYet":
    "Bộ thẻ này chưa được lưu — chưa có gì vào tài khoản của bạn cho đến khi bạn bấm {action}. Tiến độ ở đây được giữ trên thiết bị này nên bạn có thể quay lại sau.",
  "review.imageUploadFailed":
    "Không tải lên được một trong các ảnh của thẻ. Phần bạn làm vẫn an toàn — hãy thử lại.",
  "review.saveFailed":
    "Không lưu được bộ thẻ. Phần bạn làm vẫn an toàn — hãy thử lại.",
  "review.fieldsHeading": "Các trường hiển thị trên thẻ",
  "review.fieldsLede":
    "Đặt từng trường vào mặt Thuật ngữ hoặc Định nghĩa (hoặc Tắt), hoặc tự thêm trường mới.",
  "review.searchCards": "Tìm thẻ…",
  "review.countFiltered": "{shown} trên {total} thẻ",
  "review.noMatch": "Không có thẻ nào khớp với “{query}”.",
  "review.showMore": "Hiện thêm {count} thẻ",
  "review.remainingLeft": "(còn {count})",
  "review.showAllTitle":
    "Dựng mọi thẻ còn lại — có thể hơi lâu với bộ thẻ rất lớn",
  "review.showAll": "Hiện tất cả",
  "review.addCard": "Thêm thẻ",
  "review.visibilityHeading": "Ai có thể thấy bộ thẻ này",
  "review.public": "Công khai",
  "review.private": "Riêng tư",
  "review.publicNote":
    "Mọi người đều có thể tìm thấy bộ thẻ này ở Discover và lưu bản sao riêng. Tiến độ của bạn vẫn riêng tư. Chỉ nên đăng những bộ thẻ bạn có quyền chia sẻ.",
  "review.privateNote":
    "Chỉ bạn thấy được bộ thẻ này. Bạn có thể đăng nó sau từ menu ⋯ của bộ thẻ.",

  // ---- the two sides of a card ----------------------------------------------------------------
  "card.term": "Thuật ngữ",
  "card.definition": "Định nghĩa",

  // ---- which fields show on a card ------------------------------------------------------------
  "fields.cardsFallback": "Thẻ",
  "fields.shown": "hiện {count}",
  "fields.deleteField": "Xoá trường {name}",
  "fields.deleteThisField": "Xoá trường này",
  "fields.needOneField": "Mỗi thẻ cần ít nhất một trường ở mặt này",
  "fields.hasContent": "Trường này có nội dung — bỏ tích để ẩn thay vì xoá",
  "fields.addToTerm": "Thêm trường vào mặt thuật ngữ",
  "fields.addToDefinition": "Thêm trường vào mặt định nghĩa",
  "fields.namePlaceholder": "Tên trường (ví dụ: Ví dụ)",
  "fields.add": "Thêm",
  "fields.duplicate": "Đã có trường tên “{name}”.",
  "card.termVoice": "Giọng đọc thuật ngữ",
  "card.definitionVoice": "Giọng đọc định nghĩa",
  "card.cloze": "Cloze",
  "card.swapFaces": "Đảo mặt trước/mặt sau",
  "card.delete": "Xoá thẻ",
  // ---- generate a deck with AI ----------------------------------------------------------------
  "aiGen.tabText": "Dán ghi chú",
  "aiGen.tabPdf": "Tải lên PDF",
  "aiGen.yourNotes": "Ghi chú của bạn",
  "aiGen.notesPlaceholder": "Dán một chương, một danh sách từ vựng, ghi chú bài giảng…",
  "aiGen.needMore":
    "Hãy dán ít nhất một đoạn — không thể tạo thẻ từ một dòng.",
  "aiGen.charCount": "{count} ký tự",
  "aiGen.choosePdf": "Chọn một tệp PDF",
  "aiGen.pdfChosen": "{size} MB — bấm để chọn tệp khác",
  "aiGen.pdfHint":
    "Tối đa {limit} MB. Tệp cần có chữ chọn được — bản scan sẽ không dùng được.",
  "aiGen.deckName": "Tên bộ thẻ",
  "aiGen.optional": "(không bắt buộc)",
  "aiGen.fromFileName": "Lấy từ tên tệp",
  "aiGen.fromFirstLine": "Lấy từ dòng đầu tiên",
  "aiGen.upTo": "Tối đa",
  "aiGen.maxCards": "Số thẻ tối đa",
  "aiGen.cardsOption": "{count} thẻ",
  "aiGen.generating": "Đang tạo…",
  "aiGen.generate": "Tạo thẻ",
  "aiGen.takesAMinute":
    "Với tài liệu dài, việc này có thể mất tới một phút — hãy giữ tab này mở.",

  "aiGen.ownKeyNotice":
    "Tài liệu của bạn được gửi tới nhà cung cấp AI bằng khoá API của riêng bạn, theo thoả thuận giữa bạn và họ.",
  "aiGen.freeTierNotice":
    "Tài liệu của bạn được gửi tới nhà cung cấp AI của chúng tôi để tạo thẻ. Chúng tôi dùng gói miễn phí, nên nhà cung cấp có thể dùng nội dung được gửi để cải thiện sản phẩm của họ, bao gồm cả việc con người xem lại.",
  "aiGen.dontPasteConfidential": "Đừng dán bất cứ thông tin bí mật nào.",
  "aiGen.addOwnKey": "Thêm khoá API của riêng bạn",
  "aiGen.toUseOwnAccount": "để dùng tài khoản của bạn thay thế.",
  "aiGen.draftNotice":
    "Thẻ chỉ là bản nháp — bạn xem và sửa từng thẻ trước khi bộ thẻ được lưu.",

  "aiGen.ready": "{count} thẻ đã sẵn sàng để xem lại",
  "aiGen.startOver": "Làm lại từ đầu",
  "aiGen.reviewCards": "Xem lại các thẻ",

  "aiGen.remainingShared": "Còn {count} lượt tạo miễn phí hôm nay",
  "aiGen.remainingOwnKey": "Còn {count} lượt tạo hôm nay bằng khoá của bạn",

  "aiGen.inputTruncated":
    "Tài liệu khá dài nên chỉ phần đầu được dùng. Hãy tạo lại từ phần còn lại để tiếp tục.",
  "aiGen.partialRun":
    "AI dừng giữa chừng nên đây là những thẻ nó kịp tạo. Bạn có thể tạo phần còn lại riêng.",

  "aiGen.notAPdf": "Tệp đó không giống một tệp PDF.",
  "aiGen.emptyFile": "Tệp đó trống.",
  "aiGen.pdfTooLarge": "Tệp PDF đó lớn hơn {limit} MB. Hãy thử một chương riêng.",
  "media.addImage": "Thêm ảnh",
  "media.removeImage": "Xoá ảnh",
  "media.chooseImage": "Vui lòng chọn một tệp ảnh.",
  "media.imageUploadFailed": "Không tải lên được ảnh đó. Hãy thử lại.",
  "media.addAudio": "Thêm âm thanh",
  "media.removeAudio": "Xoá âm thanh",
  "media.chooseAudio": "Vui lòng chọn một tệp âm thanh.",
  "media.audioUploadFailed": "Không tải lên được âm thanh đó. Hãy thử lại.",
  "media.uploading": "Đang tải lên…",
  // ---- Learn settings -------------------------------------------------------------------------
  "learn.settingsTitle": "Cài đặt chế độ Học",
  "learn.perSession": "Số thẻ mỗi phiên",
  "learn.perSessionRetry":
    "Thẻ trả lời sai sẽ quay lại cho tới khi bạn làm đúng, nên phiên kết thúc khi mọi thẻ đã học xong.",
  "learn.perSessionOnce":
    "Mỗi thẻ chỉ được hỏi một lần, nên phiên kết thúc sau số câu này.",
  "learn.noCardsMatch": "Không có thẻ nào khớp với cài đặt này.",
  "learn.onlyNMatch": "Chỉ có {count} thẻ khớp, nên bạn sẽ học hết số đó.",
  "learn.belowMinimum":
    "Mỗi phiên học ít nhất {min} thẻ, nên phiên này bắt đầu với {effective} thẻ.",
  "learn.cappedToPool": "Chỉ có {count} thẻ khớp, nên phiên này học cả {count} thẻ.",
  "learn.poolAvailable": "Có {count} thẻ khả dụng.",

  "learn.questionTypes": "Dạng câu hỏi",
  "learn.questionTypesDesc":
    "Mỗi lần một thẻ xuất hiện, nó sẽ được hỏi theo một trong các dạng này.",
  "learn.answerWith": "Trả lời bằng",
  "learn.answerWithDefinitionDesc":
    "Xem thuật ngữ, trả lời bằng định nghĩa của nó.",
  "learn.answerWithTermDesc":
    "Xem định nghĩa, trả lời bằng thuật ngữ. Thẻ Cloze luôn được hỏi đúng như đã viết.",

  "learn.starredOnly": "Chỉ thẻ đã gắn sao",
  "learn.starredCount": "{count} thẻ đã gắn sao.",
  "learn.starSomeFirst": "Hãy gắn sao một vài thẻ để dùng mục này.",
  "learn.includeMastered": "Gồm cả thẻ đã thành thạo",
  "learn.includeMasteredDesc": "Tắt để bỏ qua những thẻ bạn đã thành thạo.",
  "learn.shuffle": "Trộn thẻ",
  "learn.shuffleDesc": "Tắt để học theo đúng thứ tự trong bộ thẻ.",
  "learn.retryMissed": "Đưa lại thẻ trả lời sai",
  "learn.retryMissedDesc":
    "Hỏi lại thẻ bạn trả lời sai ở cuối phiên cho tới khi bạn làm đúng.",
  "learn.retypeWrong": "Nhập lại câu trả lời viết sai",
  "learn.retypeWrongDesc": "Nhập đúng câu trả lời trước khi sang thẻ tiếp theo.",
  "learn.smartGrading": "Chấm điểm linh hoạt",
  "learn.smartGradingDesc": "Bỏ qua lỗi chính tả nhỏ trong câu trả lời viết dài.",
  "learn.readAloud": "Đọc câu hỏi thành tiếng",
  "learn.readAloudDesc": "Đọc mỗi câu hỏi khi nó xuất hiện.",
  "learn.readAloudUnsupported": "Trình duyệt này không đọc được thành tiếng.",

  "learn.startLearning": "Bắt đầu học",
  "learn.restartSession": "Học lại phiên này",
  // ---- Flashcards options ---------------------------------------------------------------------
  "flash.optionsTitle": "Tùy chọn thẻ ghi nhớ",
  "flash.questionFormat": "Dạng câu hỏi",
  "flash.answerWithTerm": "Trả lời bằng thuật ngữ",
  "flash.answerWithTermHelp":
    "Hiện mặt định nghĩa trước; bạn nhứ lại thuật ngữ.",
  "flash.answerWithDefinition": "Trả lời bằng định nghĩa",
  "flash.answerWithDefinitionHelp":
    "Hiện mặt thuật ngữ trước; bạn nhứ lại định nghĩa.",
  "flash.learningOptions": "Tùy chọn học",
  "flash.cardSorting": "Phân loại thẻ",
  "flash.cardSortingHelp":
    "Đánh dấu từng thẻ là Đã biết / Đang học trong lúc học.",
  "flash.starredOnly": "Chỉ học thẻ đã gắn sao",
  "flash.starredOnlyHelp":
    "Giới hạn bộ thẻ ở những thẻ bạn đã gắn sao.",
  "flash.starredNone":
    "Hãy gắn sao một vài thẻ trước để dùng mục này.",
  "flash.shuffle": "Trộn thẻ",
  "flash.shuffleHelp": "Xếp ngẫu nhiên thứ tự thẻ mỗi lần học.",
  "flash.playback": "Phát tự động",
  "flash.autoplaySpeed": "Tốc độ phát tự động",
  "flash.autoplaySpeedHelp":
    "Mỗi mặt được giữ bao lâu trước khi tự lật hoặc chuyển thẻ.",
  "flash.cardFields": "Các trường của thẻ",
  "flash.cardFieldsHelp":
    "Bộ thẻ của bạn có thêm trường từ lúc nhập. Chọn những trường cũng xuất hiện ở mặt định nghĩa của mỗi thẻ — điều này cũng đặt trường mặc định cho bài trắc nghiệm.",
  "flash.pronunciation": "Phát âm",
  "flash.pronunciationHelp":
    "Giọng dùng cho nút Nghe (chuyển văn bản thành giọng nói). Tự nhận diện sẽ đoán từ nội dung — hãy chọn tay nếu một ngôn ngữ bị đọc sai (ví dụ kanji bị đọc như tiếng Trung).",
  "flash.termLanguage": "Ngôn ngữ thuật ngữ",
  "flash.termLanguageHelp": "Mặt trước của mỗi thẻ.",
  "flash.definitionLanguage": "Ngôn ngữ định nghĩa",
  "flash.definitionLanguageHelp": "Mặt sau của mỗi thẻ.",
  "flash.saveOptions": "Lưu tùy chọn",
  "flash.restart": "Học lại từ đầu",

  "autoplay.fast": "Nhanh · {seconds}s",
  "autoplay.normal": "Bình thường · {seconds}s",
  "autoplay.slow": "Chậm · {seconds}s",
  "autoplay.verySlow": "Rất chậm · {seconds}s",
  "common.dialog": "Hộp thoại",
  "legal.lastUpdated": "Cập nhật lần cuối {date}",
  // ---- /export (make a quiz deck for Anki) ----------------------------------------------------
  "export.heading": "Tạo bộ thẻ trắc nghiệm cho Anki",
  "export.lede":
    "Mỗi thẻ trở thành một câu hỏi trắc nghiệm, với các đáp án sai lấy từ những thẻ khác trong cùng bộ. Anki sẽ trộn các lựa chọn mỗi lần ôn và bộ định thời của nó làm phần còn lại — không cần add-on nào.",
  "export.sourceTablist": "Bộ thẻ lấy từ đâu",
  "export.fromDeck": "Một bộ thẻ của bạn",
  "export.fromUpload": "Tải lên .apkg",
  "export.noDecks":
    "Bạn chưa có bộ thẻ nào. Hãy nhập một bộ trước, hoặc chuyển sang thẻ tải lên để chuyển đổi một tệp .apkg mà không cần lưu.",
  "export.deck": "Bộ thẻ",
  "export.chooseDeck": "Chọn một bộ thẻ…",
  "export.chooseFile": "Chọn một tệp .apkg",
  "export.nothingSaved":
    "Không có gì được lưu vào tài khoản của bạn — tệp được chuyển đổi và trả lại ngay.",
  "export.mediaNotCarried":
    "Hình ảnh và âm thanh trong bộ thẻ tải lên sẽ không được mang theo. Hãy nhập bộ thẻ trước nếu bạn muốn giữ chúng.",
  "export.convertAndDownload": "Chuyển đổi và tải về",
  "export.download": "Tải bộ thẻ trắc nghiệm",
  "export.building": "Đang tạo…",
  "export.checkFailed": "Không kiểm tra được bộ thẻ này. Hãy thử lại.",
  "export.noneQuizzable": "Không thẻ nào trong bộ này có thể thành câu hỏi.",
  "export.becomeQuestions": "{exported} trên {total} thẻ trở thành câu hỏi trắc nghiệm.",
  "export.converted": "Đã chuyển đổi {exported} trên {total} thẻ.",
  "export.couldNotConvert": "{count} thẻ không thể thành câu hỏi.",
  "export.skippedReason": "bỏ qua {count} — {reason}",
  "export.failed":
    "Không thành công. Tệp có thể không phải một gói Anki hợp lệ, hoặc bộ thẻ quá lớn.",
  "export.checking": "Đang kiểm tra xem thẻ nào có thể thành câu hỏi…",
  // ---- Export deck modal ----------------------------------------------------------------------
  "exportModal.title": "Xuất bộ thẻ",
  "exportModal.format": "Định dạng",
  "exportModal.csv": "CSV / TSV",
  "exportModal.csvHint": "Bảng tính hoặc nhập lại vào Anki — mỗi thẻ một dòng.",
  "exportModal.apkg": "Anki .apkg",
  "exportModal.apkgHint": "Một gói Anki thực sự, mở được ngay trong Anki.",
  "exportModal.mcq": "Trắc nghiệm Anki",
  "exportModal.mcqHint": "Mỗi thẻ trở thành một câu hỏi bạn trả lời ngay trong Anki.",
  "exportModal.text": "Văn bản thuần",
  "exportModal.textHint": "Kiểu Quizlet — dán vào hộp nhập của Quizlet.",
  "exportModal.checkFailedHere":
    "Không kiểm tra được bộ thẻ này. Hãy thử lại, hoặc tải về và xem kết quả.",
  "exportModal.mcqNote":
    "Các đáp án sai lấy từ những thẻ khác trong cùng bộ, và Anki trộn chúng mỗi lần ôn. Hình ảnh và âm thanh đi kèm theo.",
  "exportModal.separator": "Ký tự phân cách",
  "exportModal.comma": "Dấu phẩy (.csv)",
  "exportModal.tab": "Tab (.tsv)",
  "exportModal.includeTags": "Kèm cột Thẻ phân loại",
  "exportModal.multipleNoteTypes":
    "Bộ thẻ này có nhiều loại ghi chú — mỗi loại được xuất thành một khối riêng, có dòng “# tên” ở đầu.",
  "exportModal.betweenTermDef": "Giữa thuật ngữ và định nghĩa",
  "exportModal.betweenRows": "Giữa các dòng",
  "exportModal.custom": "Tùy chỉnh",
  "exportModal.customExample": "ví dụ: -",
  "exportModal.apkgNote":
    "Tạo một gói Anki trên máy chủ rồi tải về. Tiến độ học không được kèm theo — chỉ có ghi chú và các trường của chúng.",
  "exportModal.preview": "Xem trước",
  "exportModal.apkgFailed": "Không tạo được tệp .apkg. Vui lòng thử lại.",
  "exportModal.copied": "Đã sao chép ✓",
  "exportModal.copy": "Sao chép vào bộ nhớ tạm",
  "exportModal.downloadApkg": "Tải .apkg",
  "exportModal.downloadPlain": "Tải về",
} as const satisfies CatalogueOf<typeof en>;
