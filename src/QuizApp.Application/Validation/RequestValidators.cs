using FluentValidation;
using QuizApp.Application.Dtos;

namespace QuizApp.Application.Validation;

// Validator cho request DTO. Chạy tự động trước khi vào action (FluentValidationFilter ở tầng Api);
// lỗi trả về ValidationProblem (code VALIDATION_FAILED, errors theo từng field).

// ---------- Auth (UC01 / UC02) ----------

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Username).Required("Username is required.").LengthBetween(3, 100);
        RuleFor(x => x.Email).Required("Email is required.").EmailAddress().MaxLength(255);
        RuleFor(x => x.Password).Required("Password is required.")
            .LengthBetween(6, 100, "Password must be at least 6 characters.");
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.UsernameOrEmail).Required("Username or email is required.").MaxLength(255);
        RuleFor(x => x.Password).Required("Password is required.").MaxLength(100);
    }
}

// ---------- Quiz (UC11 / UC12) ----------

public sealed class QuizRequestValidator : AbstractValidator<QuizRequest>
{
    public QuizRequestValidator()
    {
        RuleFor(x => x.Title).Required("Title is required.").MaxLength(255, "Title must not exceed 255 characters.");
        RuleFor(x => x.Description).MaxLength(2000);
        RuleFor(x => x.Duration).InclusiveBetween(1, 600).WithMessage("Duration must be between 1 and 600 minutes.");
    }
}

// ---------- Question Bank / Question / Answer (UC13 / UC15) ----------

public sealed class QuestionBankRequestValidator : AbstractValidator<QuestionBankRequest>
{
    public QuestionBankRequestValidator()
    {
        RuleFor(x => x.Name).Required("Name is required.").MaxLength(255);
        RuleFor(x => x.Description).MaxLength(2000);
    }
}

public sealed class AnswerRequestValidator : AbstractValidator<AnswerRequest>
{
    public AnswerRequestValidator()
    {
        RuleFor(x => x.Content).Required("Content is required.").MaxLength(2000);
    }
}

/// <summary>Cùng rule với AnswerRequest (lớp con chỉ thêm AnswerId).</summary>
public sealed class EditAnswerRequestValidator : AbstractValidator<EditAnswerRequest>
{
    public EditAnswerRequestValidator() => Include(new AnswerRequestValidator());
}

/// <summary>Nội dung + loại câu hỏi — dùng chung cho mọi request tạo / sửa Question.</summary>
public sealed class QuestionRequestValidator : AbstractValidator<QuestionRequest>
{
    public QuestionRequestValidator()
    {
        RuleFor(x => x.Content).Required("Content is required.").MaxLength(4000);
        // QuestionType nullable cố ý: client quên gửi field -> null -> báo "is required" (thay vì nhận giá trị mặc định)
        RuleFor(x => x.QuestionType).NotNull().WithMessage("QuestionType is required.")
            .DefinedEnum("QuestionType is not supported.");
    }
}

public sealed class QuestionAndAnswersRequestValidator : AbstractValidator<QuestionAndAnswersRequest>
{
    public QuestionAndAnswersRequestValidator()
    {
        Include(new QuestionRequestValidator());
        RuleFor(x => x.Answers).NotNull().WithMessage("The Answers field is required.");
        RuleForEach(x => x.Answers).SetValidator(new AnswerRequestValidator());
    }
}

public sealed class ReplaceQuestionRequestValidator : AbstractValidator<ReplaceQuestionRequest>
{
    public ReplaceQuestionRequestValidator()
    {
        Include(new QuestionRequestValidator());
        RuleFor(x => x.Answers).NotNull().WithMessage("The Answers field is required.")
            .MaxCount(50, "A question can have at most 50 answers.");
        RuleForEach(x => x.Answers).SetValidator(new EditAnswerRequestValidator());
    }
}

// ---------- Quiz questions (UC13 / UC17) ----------

public sealed class NewQuestionPayloadValidator : AbstractValidator<NewQuestionPayload>
{
    public NewQuestionPayloadValidator()
    {
        RuleFor(x => x.Content).Required("Content is required.").MaxLength(4000);
        RuleFor(x => x.QuestionType).NotNull().WithMessage("QuestionType is required.")
            .DefinedEnum("QuestionType is not supported.");
        RuleFor(x => x.Answers).NotNull().WithMessage("The Answers field is required.");
        RuleForEach(x => x.Answers).SetValidator(new AnswerRequestValidator());
    }
}

public sealed class AddQuizQuestionRequestValidator : AbstractValidator<AddQuizQuestionRequest>
{
    public AddQuizQuestionRequestValidator()
    {
        // Lỗi của câu hỏi mới có key dạng "NewQuestion.Content" (giống DataAnnotations trước đây)
        RuleFor(x => x.NewQuestion!).SetValidator(new NewQuestionPayloadValidator()).When(x => x.NewQuestion is not null);
    }
}

public sealed class ReorderQuizQuestionsRequestValidator : AbstractValidator<ReorderQuizQuestionsRequest>
{
    public ReorderQuizQuestionsRequestValidator()
    {
        RuleFor(x => x.QuestionIds).NotNull().WithMessage("The QuestionIds field is required.")
            .MinCount(1).MaxCount(500);
    }
}

// ---------- Attempts (UC09) / grading ----------

public sealed class AttemptAnswerRequestValidator : AbstractValidator<AttemptAnswerRequest>
{
    public AttemptAnswerRequestValidator()
    {
        RuleFor(x => x.QuestionId).GreaterThanOrEqualTo(1).WithMessage("QuestionId is required.");
        RuleFor(x => x.ResponseText).MaxLength(4000);
    }
}

public sealed class SubmitAttemptRequestValidator : AbstractValidator<SubmitAttemptRequest>
{
    public SubmitAttemptRequestValidator()
    {
        // Cho phép danh sách rỗng: nộp bài trống được chấm 0 điểm (UC09 A1)
        RuleFor(x => x.Answers).NotNull().WithMessage("The Answers field is required.")
            .MaxCount(200, "Too many answers in one submission.");
        RuleForEach(x => x.Answers).SetValidator(new AttemptAnswerRequestValidator());
    }
}

public sealed class GradeAnswerRequestValidator : AbstractValidator<GradeAnswerRequest>
{
    public GradeAnswerRequestValidator()
    {
        RuleFor(x => x.IsCorrect).NotNull().WithMessage("IsCorrect is required.");
    }
}

// ---------- Administration (UC18 – UC20) ----------

public sealed class UpdateUserStatusRequestValidator : AbstractValidator<UpdateUserStatusRequest>
{
    public UpdateUserStatusRequestValidator()
    {
        // Giá trị cụ thể (Active / Blocked) được kiểm tra trong service -> INVALID_STATUS
        RuleFor(x => x.Status).Required("Status is required.");
    }
}

public sealed class UpdateContentStatusRequestValidator : AbstractValidator<UpdateContentStatusRequest>
{
    public UpdateContentStatusRequestValidator()
    {
        // Giá trị cụ thể (Active / Removed) được kiểm tra trong service -> INVALID_STATUS
        RuleFor(x => x.Status).Required("Status is required.");
    }
}
