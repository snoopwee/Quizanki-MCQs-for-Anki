import Link from "next/link";
import { ContactLink, LegalList, LegalSection, LegalText } from "@/components/legal/LegalPage";

/**
 * The Vietnamese privacy policy.
 *
 * <p>A whole DOCUMENT rather than entries in the message catalogue, and deliberately so. Legal
 * prose is reviewed and amended as a document; splitting 4,000 words into key-value pairs would
 * make it unreadable to whoever has to check it, and would bury 500 UI strings under it. The
 * catalogue keeps the chrome ("Last updated"); the policies keep themselves.
 *
 * <p>⚠ Keep this in step with {@link PrivacyEn}. The English version governs (see the notice the
 * page renders above), but a translation that has silently fallen behind is still a bad thing to
 * show somebody. Section order here mirrors the English one so the two can be diffed by eye.
 */

export const privacyViTitle = "Chính sách quyền riêng tư";

export const privacyViDescription =
  "Quizanki thu thập những gì, cái gì được giữ riêng tư, ai xử lý dữ liệu, và cách yêu cầu xoá tài khoản cùng dữ liệu của bạn.";

/** Written in Vietnamese date order; the English page keeps its own. */
export const privacyViUpdated = "26 tháng 10, 2026";

export function PrivacyViSummary() {
  return (
    <>
      Quizanki lưu các bộ thẻ bạn tải lên, kết quả đúng sai của bạn, và địa chỉ email bạn dùng để
      đăng ký. Địa chỉ email của bạn không bao giờ được hiển thị cho người khác. Không có quảng cáo,
      không có công cụ phân tích hay theo dõi của bên thứ ba.
    </>
  );
}

export function PrivacyViBody() {
  return (
    <>
      <LegalSection heading="Ai vận hành Quizanki">
        <LegalText>
          Quizanki là một công cụ học tập giúp biến bộ thẻ Anki thành bài trắc nghiệm, do một
          nhà phát triển cá nhân vận hành chứ không phải một công ty. Về bất cứ điều gì trong chính
          sách này, bao gồm yêu cầu xem hoặc xoá dữ liệu của bạn, hãy viết tới <ContactLink />.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Những gì được thu thập">
        <LegalText>
          <strong className="font-medium text-ink">Tài khoản của bạn.</strong> Địa chỉ email,
          tên người dùng bạn chọn, và một mật khẩu chỉ được lưu dưới dạng mã băm — không bao
          giờ ở dạng mà ai đọc được, kể cả chúng tôi. Nếu bạn đăng nhập bằng Google, Google
          cung cấp cho chúng tôi tên, địa chỉ email và ảnh đại diện của bạn; chúng tôi không bao
          giờ thấy mật khẩu Google của bạn. Ngoài ra, ảnh đại diện nếu bạn tải lên.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">Những gì bạn đưa vào.</strong> Các bộ thẻ bạn
          tải lên hoặc tạo ra: tên bộ thẻ, thẻ, trường, thẻ phân loại, cùng mọi hình ảnh hoặc
          âm thanh bên trong.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">Cách bạn học.</strong> Bạn trả lời đúng hay sai
          câu nào, vào lúc nào, trong phiên nào; những thẻ bạn đã gắn sao; những ngày bạn học,
          để vẽ chuỗi ngày; thư mục, đánh giá bộ thẻ và những người bạn theo dõi.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">Bản ghi kỹ thuật.</strong> Địa chỉ IP và
          user-agent của trình duyệt, được ghi lại cùng các yêu cầu. Chúng được dùng để áp
          giới hạn tần suất và để điều tra hành vi lạm dụng cũng như lỗi, không phải để xây dựng
          một hồ sơ về bạn.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Cái gì công khai và cái gì không">
        <LegalText>
          Đây là phần nên đọc hai lần, vì đây là phần mà người khác có thể thấy:
        </LegalText>
        <LegalList>
          <li>
            <strong className="font-medium text-ink">
              Địa chỉ email của bạn luôn riêng tư.
            </strong>{" "}
            Nó không bao giờ hiển thị trên trang cá nhân, trên một bộ thẻ, hay với người dùng khác.
          </li>
          <li>
            <strong className="font-medium text-ink">Tên người dùng của bạn là công khai.</strong>{" "}
            Đó là cái tên đứng tên cho mọi bộ thẻ bạn chia sẻ, và trang cá nhân của bạn là công khai.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Một bộ thẻ là riêng tư cho tới khi bạn chia sẻ nó.
            </strong>{" "}
            Bộ thẻ bạn đặt công khai có thể được mở, học và sao chép bởi bất cứ ai có đường
            liên kết, kể cả người chưa đăng nhập.
          </li>
          <li>
            <strong className="font-medium text-ink">
              Đánh giá là công khai; phản hồi viết thì không.
            </strong>{" "}
            Số sao bạn cho được tính vào điểm công khai của bộ thẻ. Ghi chú bạn viết kèm theo
            chỉ hiển thị cho tác giả của bộ thẻ đó, và không kèm tên bạn.
          </li>
          <li>
            <strong className="font-medium text-ink">Bản ghi học tập là của bạn.</strong> Điểm số,
            chuỗi ngày, thẻ đã gắn sao và thư mục chỉ bạn thấy được. Danh sách người theo dõi và
            đang theo dõi chỉ chính chủ thấy được.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="Tính năng AI, và điều gì xảy ra với nội dung bạn gửi">
        <LegalText>
          Việc tạo bộ thẻ từ văn bản hoặc tệp PDF, và nút “Giải thích thẻ này”, sẽ gửi nội
          dung đó tới API Gemini của Google để tạo ra kết quả.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            Hãy lưu ý rằng nội dung gửi qua hạn mức miễn phí dùng chung có thể được Google dùng
            để cải thiện mô hình của họ, và có thể được con người ở đó xem lại.
          </strong>{" "}
          Vì vậy đừng dán bất cứ thông tin bí mật nào vào các tính năng AI. Nếu bạn cung cấp
          khoá API Gemini của riêng mình, yêu cầu sẽ đi qua khoá của bạn và điều khoản của Google
          áp dụng cho tài khoản riêng của bạn.
        </LegalText>
        <LegalText>
          Các giải thích được tạo ra sẽ được lưu đệm, đánh khoá bằng mã băm của chính nội dung
          thẻ, để cùng một thẻ không phải gửi đi lần nữa. Bộ đệm đó chứa nội dung thẻ và phần
          giải thích, không chứa gì về người đã hỏi.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Những bên khác xử lý dữ liệu của bạn">
        <LegalText>
          Quizanki không bán dữ liệu của bạn và không chia sẻ nó cho mục đích quảng cáo. Dữ liệu
          được xử lý bởi các dịch vụ vận hành sản phẩm:
        </LegalText>
        <LegalList>
          <li>
            <strong className="font-medium text-ink">Supabase</strong> — tài khoản và đăng nhập,
            cơ sở dữ liệu, và lưu trữ hình ảnh cùng âm thanh. Đặt tại Singapore.
          </li>
          <li>
            <strong className="font-medium text-ink">Render</strong> — chạy máy chủ ứng dụng.
          </li>
          <li>
            <strong className="font-medium text-ink">Vercel</strong> — phục vụ trang web.
          </li>
          <li>
            <strong className="font-medium text-ink">Cloudflare</strong> — DNS cho tên miền.
          </li>
          <li>
            <strong className="font-medium text-ink">Resend</strong> — gửi email tài khoản như
            đặt lại mật khẩu và xác nhận.
          </li>
          <li>
            <strong className="font-medium text-ink">Google</strong> — API Gemini cho các tính năng
            AI nói trên, và đăng nhập Google nếu bạn dùng.
          </li>
        </LegalList>
        <LegalText>
          Dữ liệu cũng có thể được tiết lộ nếu chúng tôi bị pháp luật yêu cầu, hoặc khi cần
          thiết để điều tra hành vi lạm dụng hoặc bảo vệ dịch vụ và người dùng của nó.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Cookie và những gì được giữ trong trình duyệt">
        <LegalText>
          Quizanki đặt cookie cho một mục đích duy nhất: giữ bạn đăng nhập. Không có cookie
          quảng cáo và không có trình phân tích hay theo dõi của bên thứ ba, nên không có gì
          để bạn phải từ chối.
        </LegalText>
        <LegalText>
          Một số thứ được lưu trong trình duyệt và không bao giờ gửi tới chúng tôi: một bản
          nhập chưa lưu mà bạn đang làm giữa dở, cài đặt giao diện và cỡ chữ của bạn, và — nếu
          bạn dùng Quizanki mà không có tài khoản — tiến độ bài trắc nghiệm dùng thử của bạn.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Dữ liệu được giữ bao lâu">
        <LegalText>
          Tài khoản của bạn và các bộ thẻ trong đó được giữ cho tới khi bạn yêu cầu xoá. Bản
          ghi học tập được giữ trong suốt thời gian tài khoản tồn tại, vì đó chính là thứ tạo
          nên chuỗi ngày và các số liệu tiến độ. Thông báo được dọn tự động sau một thời gian.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Xem, sửa hoặc xoá dữ liệu của bạn">
        <LegalText>
          Bạn có thể sửa hoặc xoá bất cứ bộ thẻ nào, và đổi tên người dùng, địa chỉ email, mật
          khẩu và ảnh đại diện, ngay trong ứng dụng bất cứ lúc nào.
        </LegalText>
        <LegalText>
          <strong className="font-medium text-ink">
            Để xoá toàn bộ tài khoản, hãy gửi email tới <ContactLink /> từ chính địa chỉ bạn
            đã dùng để đăng ký
          </strong>{" "}
          và nói rằng bạn muốn xoá nó. Tài khoản sẽ được xoá cùng với các bộ thẻ, tệp
          đã tải lên và bản ghi học tập, trong vòng 30 ngày. Nút tự phục vụ cho việc này chưa
          được xây dựng, đó chính là lý do có đường email này — yêu cầu đều được thực hiện dù bằng
          cách nào. Cũng địa chỉ đó sẽ gửi cho bạn một bản sao dữ liệu nếu bạn muốn.
        </LegalText>
        <LegalText>
          Một điều việc xoá không vươn tới được: nếu bạn đã chia sẻ công khai một bộ thẻ và
          người khác đã sao nó về thư viện của họ, bản sao đó giờ là dữ liệu của họ và vẫn ở lại
          với họ.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Trẻ em">
        <LegalText>
          Quizanki không dành cho trẻ em dưới 13 tuổi, và không nên tạo tài khoản cho các em.
          Nếu bạn cho rằng một trẻ em đã tạo tài khoản, hãy gửi email tới <ContactLink /> và
          tài khoản đó sẽ được xoá.
        </LegalText>
      </LegalSection>

      <LegalSection heading="Thay đổi đối với chính sách này">
        <LegalText>
          Nếu chính sách này thay đổi, ngày ở đầu trang sẽ thay đổi theo. Bất cứ điều gì ảnh
          hưởng đáng kể tới những gì được thu thập hoặc ai nhận dữ liệu sẽ được nêu rõ trong ứng
          dụng chứ không được đưa vào một cách lặng lẽ.
        </LegalText>
        <LegalText>
          Xem thêm{" "}
          <Link
            href="/terms"
            className="font-medium text-accent underline decoration-accent/30 underline-offset-2 transition hover:decoration-accent"
          >
            điều khoản dịch vụ
          </Link>
          .
        </LegalText>
      </LegalSection>
    </>
  );
}
