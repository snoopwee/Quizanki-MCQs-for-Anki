import Link from "next/link";
import { ContactLink, LegalList, LegalSection, LegalText } from "@/components/legal/LegalPage";

/**
 * The Vietnamese terms of service.
 *
 * <p>A whole document, for the same reason as {@link PrivacyViBody}: legal prose is reviewed and
 * amended as prose, not as key-value pairs.
 *
 * <p>⚠ Keep in step with {@link TermsEnBody} — the English version governs (the page says so), but
 * a stale translation is still the wrong thing to show. Section order mirrors the English.
 */

const linkClass =
  "font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent";

export const termsViTitle = "Điều khoản dịch vụ";

export const termsViDescription =
  "Điều khoản sử dụng Quizanki: tài khoản của bạn, ai sở hữu các bộ thẻ bạn tải lên, có thể và không thể dựa vào tính năng AI để làm gì, và dịch vụ có thể thay đổi thế nào.";

export const termsViUpdated = "26 tháng 10, 2026";

export function TermsViSummary() {
  return (
    <>
      Quizanki là một công cụ học tập miễn phí. Các bộ thẻ vẫn thuộc về bạn, bạn chịu trách
      nhiệm về việc có quyền tải chúng lên, và vì dịch vụ miễn phí do một người vận hành nên
      không có cam kết về thời gian hoạt động — hãy tự giữ bản sao những gì bạn coi trọng.
    </>
  );
}

export function TermsViBody() {
  return (
    <>
      <LegalSection heading="Quizanki là gì">
        <LegalText>
          Quizanki biến bộ thẻ Anki thành bài trắc nghiệm, thẻ ghi nhớ, bài kiểm tra thử và trò
          ghép thẻ. Bạn có thể tải lên tệp{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.8em] text-ink">.apkg</code>, tự
          tạo bộ thẻ bằng tay, tạo bằng AI, hoặc học một bộ thẻ người khác đã chia sẻ. Việc
          sử dụng đồng nghĩa với việc bạn chấp nhận các điều khoản này.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Tài khoản của bạn">
        <LegalText>
          Bạn cần ít nhất 13 tuổi để có tài khoản. Hãy dùng địa chỉ email mà bạn thực sự kiểm
          soát, giữ mật khẩu cho riêng mình, và cho chúng tôi biết tại <ContactLink /> nếu bạn
          cho rằng người khác đã vào được tài khoản của bạn. Bạn chịu trách nhiệm về những gì
          diễn ra dưới tài khoản đó.
        </LegalText>
        <LegalText>
          Tên người dùng của bạn là công khai và đứng tên cho mọi bộ thẻ bạn chia sẻ. Nó
          không được mạo danh người khác hoặc được chọn nhằm gây nhầm lẫn.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Các bộ thẻ vẫn thuộc về bạn">
        <LegalText>
          Bạn giữ quyền sở hữu mọi thứ bạn tải lên hoặc tạo ra. Khi dùng Quizanki, bạn cho phép
          lưu trữ, xử lý và hiển thị lại những nội dung đó cho bạn — và, nếu bạn chọn chia sẻ
          công khai một bộ thẻ, hiển thị nó cho người khác và cho họ học hoặc sao lại. Quyền này
          tồn tại để sản phẩm hoạt động được; nó không phải là việc chuyển giao quyền sở hữu, và nó
          kết thúc với bất cứ thứ gì bạn xoá.
        </LegalText>
        <LegalText>
          Chia sẻ một bộ thẻ là quyết định bạn đưa ra cho từng bộ thẻ, và nó không dễ đảo ngược:
          một khi ai đó đã sao một bộ thẻ công khai, bản sao đó là của họ. Hãy coi việc đặt một
          bộ thẻ thành công khai như việc xuất bản nó.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Chỉ tải lên những gì bạn có quyền">
        <LegalText>
          Các bộ thẻ Anki được lưu hành rộng rãi và khá nhiều trong đó chứa nội dung thuộc về
          người khác — nội dung sách giáo khoa, câu hỏi thi, hình ảnh, âm thanh. Bạn chịu trách
          nhiệm về việc có quyền tải lên những gì bạn tải lên, và đặc biệt là có quyền chia sẻ
          chúng công khai.
        </LegalText>
        <LegalText>
          Nếu bạn cho rằng nội dung nào ở đây xâm phạm bản quyền của bạn, hãy gửi email tới{" "}
          <ContactLink /> kèm đường liên kết tới bộ thẻ và mô tả tác phẩm. Nội dung xâm phạm rõ
          ràng sẽ được xoá.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Sử dụng một cách đúng mực">
        <LegalText>Vui lòng không:</LegalText>
        <LegalList>
          <li>
            tải lên bất cứ nội dung trái pháp luật, lạm dụng, thù địch, hay nội dung tình dục liên
            quan đến trẻ vị thành niên;
          </li>
          <li>
            tìm cách làm hỏng, gây quá tải hoặc lách các giới hạn của dịch vụ — giới hạn tần
            suất, kích thước tệp tải lên và hạn mức AI tồn tại vì dịch vụ chạy trên hạ tầng miễn phí
            dùng chung cho tất cả mọi người;
          </li>
          <li>thu thập dữ liệu trang web hàng loạt, hoặc tự động tạo tài khoản;</li>
          <li>
            tìm cách truy cập bộ thẻ riêng tư, tài khoản hoặc bản ghi học tập của người khác, hoặc
            dò tìm lỗ hổng của dịch vụ mà không hỏi trước.
          </li>
        </LegalList>
        <LegalText>
          Tài khoản làm những việc này có thể bị tạm khoá. Nếu tài khoản của bạn bị tạm khoá, bạn
          sẽ được cho biết lý do khi đăng nhập, và bạn có thể phản hồi tại <ContactLink />.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Tính năng AI là điểm khởi đầu, không phải nguồn đáng tin tuyệt đối">
        <LegalText>
          Thẻ và phần giải thích do AI tạo ra được sinh bởi một mô hình ngôn ngữ và{" "}
          <strong className="font-medium text-ink">có thể sai một cách rất tự tin.</strong> Hãy luôn
          đối chiếu với nguồn của bạn trước khi học theo, và đừng dựa vào chúng cho bất cứ việc gì
          liên quan đến y tế, pháp lý, tài chính hoặc có hệ quả đáng kể. Thẻ được tạo ra sẽ vào một
          trình soạn thảo trước khi được lưu, chính là để bạn đọc chúng trước.
        </LegalText>
        <LegalText>
          Hạn mức AI miễn phí được chia sẻ giữa tất cả người dùng Quizanki và có thể hết, thay đổi
          độ lớn, hoặc bị ngừng. Đừng xây dựng một thói quen học phụ thuộc vào nó. Xem{" "}
          <Link href="/privacy" className={linkClass}>
            chính sách quyền riêng tư
          </Link>{" "}
          để biết điều gì xảy ra với nội dung bạn gửi tới các tính năng này — điều đó quan
          trọng, và phần đó ngắn.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Khả dụng — và việc tự giữ bản sao">
        <LegalText>
          Quizanki miễn phí và được cung cấp như hiện có, không cam kết về thời gian hoạt động,
          không cam kết hỗ trợ, và không hứa rằng một tính năng cụ thể nào sẽ tiếp tục tồn tại. Nó
          chạy trên các gói hạ tầng miễn phí; máy chủ ngủ khi không dùng và có thể chậm khi thức.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            Vì vậy hãy tự giữ bản sao những bộ thẻ quan trọng với bạn.
          </strong>{" "}
          Quizanki có thể xuất bất cứ bộ thẻ nào trở lại thành tệp Anki{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.8em] text-ink">.apkg</code> từ{" "}
          <Link href="/export" className={linkClass}>
            Tạo bộ thẻ trắc nghiệm
          </Link>
          , và bản xuất đó là của bạn. Mất dữ liệu là điều khó xảy ra nhưng ở đây không hứa
          hẹn bất cứ sắp xếp sao lưu nào.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Kết thúc">
        <LegalText>
          Bạn có thể ngừng dùng Quizanki bất cứ lúc nào, và có thể yêu cầu xoá tài khoản cùng dữ
          liệu bằng cách gửi email tới <ContactLink /> —{" "}
          <Link href="/privacy" className={linkClass}>
            chính sách quyền riêng tư
          </Link>{" "}
          giải thích việc đó bao gồm những gì. Tài khoản có thể bị tạm khoá hoặc đóng vì việc vi
          phạm các điều khoản này, và bản thân dịch vụ cũng có thể bị ngừng; nếu điều đó xảy ra,
          thông báo hợp lý sẽ được đưa ra trong ứng dụng để bạn kịp xuất các bộ thẻ của mình.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Trách nhiệm pháp lý">
        <LegalText>
          Trong phạm vi pháp luật cho phép, Quizanki được cung cấp mà không kèm bảo hành dưới bất
          kỳ hình thức nào, và nhà phát triển không chịu trách nhiệm về dữ liệu bị mất, thời gian học
          bị mất, hay bất cứ thiệt hại gián tiếp hoặc phát sinh nào từ việc sử dụng. Không điều gì ở
          đây nhằm giới hạn các quyền của bạn mà pháp luật không cho phép giới hạn.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Thay đổi đối với các điều khoản này">
        <LegalText>
          Các điều khoản này có thể thay đổi; ngày ở đầu trang sẽ thay đổi theo, và một thay đổi
          đáng kể sẽ được nêu rõ trong ứng dụng chứ không được đưa vào một cách lặng lẽ. Việc tiếp
          tục dùng Quizanki sau một thay đổi có nghĩa là bạn chấp nhận các điều khoản đã cập nhật.
        </LegalText>
        <LegalText>
          Câu hỏi về bất cứ điều gì trong số này: <ContactLink />.
        </LegalText>
      </LegalSection>
    </>
  );
}
