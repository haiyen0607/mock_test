using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizApp.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "USER",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "QUESTION_BANK",
                columns: table => new
                {
                    question_bank_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    owner_id = table.Column<int>(type: "int", nullable: false),
                    name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_public = table.Column<bool>(type: "bit", nullable: false),
                    is_deleted = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QUESTION_BANK", x => x.question_bank_id);
                    table.ForeignKey(
                        name: "FK_QUESTION_BANK_USER_owner_id",
                        column: x => x.owner_id,
                        principalTable: "USER",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QUIZ",
                columns: table => new
                {
                    quiz_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    owner_id = table.Column<int>(type: "int", nullable: false),
                    title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    duration = table.Column<int>(type: "int", nullable: false),
                    is_published = table.Column<bool>(type: "bit", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QUIZ", x => x.quiz_id);
                    table.ForeignKey(
                        name: "FK_QUIZ_USER_owner_id",
                        column: x => x.owner_id,
                        principalTable: "USER",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QUESTION",
                columns: table => new
                {
                    question_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    question_bank_id = table.Column<int>(type: "int", nullable: false),
                    content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    question_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QUESTION", x => x.question_id);
                    table.ForeignKey(
                        name: "FK_QUESTION_QUESTION_BANK_question_bank_id",
                        column: x => x.question_bank_id,
                        principalTable: "QUESTION_BANK",
                        principalColumn: "question_bank_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QUIZ_ATTEMPT",
                columns: table => new
                {
                    attempt_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    quiz_id = table.Column<int>(type: "int", nullable: false),
                    user_id = table.Column<int>(type: "int", nullable: true),
                    is_trial = table.Column<bool>(type: "bit", nullable: false),
                    guest_identifier = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    started_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    duration_minutes = table.Column<int>(type: "int", nullable: false),
                    submitted_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    score = table.Column<int>(type: "int", nullable: true),
                    correct_count = table.Column<int>(type: "int", nullable: false),
                    max_score = table.Column<int>(type: "int", nullable: false),
                    pending_count = table.Column<int>(type: "int", nullable: false),
                    row_version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QUIZ_ATTEMPT", x => x.attempt_id);
                    table.ForeignKey(
                        name: "FK_QUIZ_ATTEMPT_QUIZ_quiz_id",
                        column: x => x.quiz_id,
                        principalTable: "QUIZ",
                        principalColumn: "quiz_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QUIZ_ATTEMPT_USER_user_id",
                        column: x => x.user_id,
                        principalTable: "USER",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ANSWER",
                columns: table => new
                {
                    answer_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    question_id = table.Column<int>(type: "int", nullable: false),
                    content = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    is_correct = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ANSWER", x => x.answer_id);
                    table.ForeignKey(
                        name: "FK_ANSWER_QUESTION_question_id",
                        column: x => x.question_id,
                        principalTable: "QUESTION",
                        principalColumn: "question_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "QUIZ_QUESTION",
                columns: table => new
                {
                    quiz_id = table.Column<int>(type: "int", nullable: false),
                    question_id = table.Column<int>(type: "int", nullable: false),
                    order_index = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QUIZ_QUESTION", x => new { x.quiz_id, x.question_id });
                    table.ForeignKey(
                        name: "FK_QUIZ_QUESTION_QUESTION_question_id",
                        column: x => x.question_id,
                        principalTable: "QUESTION",
                        principalColumn: "question_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_QUIZ_QUESTION_QUIZ_quiz_id",
                        column: x => x.quiz_id,
                        principalTable: "QUIZ",
                        principalColumn: "quiz_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ATTEMPT_ANSWER",
                columns: table => new
                {
                    attempt_answer_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    attempt_id = table.Column<int>(type: "int", nullable: false),
                    question_id = table.Column<int>(type: "int", nullable: false),
                    answer_id = table.Column<int>(type: "int", nullable: true),
                    response_text = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    is_correct = table.Column<bool>(type: "bit", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ATTEMPT_ANSWER", x => x.attempt_answer_id);
                    table.ForeignKey(
                        name: "FK_ATTEMPT_ANSWER_ANSWER_answer_id",
                        column: x => x.answer_id,
                        principalTable: "ANSWER",
                        principalColumn: "answer_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ATTEMPT_ANSWER_QUESTION_question_id",
                        column: x => x.question_id,
                        principalTable: "QUESTION",
                        principalColumn: "question_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ATTEMPT_ANSWER_QUIZ_ATTEMPT_attempt_id",
                        column: x => x.attempt_id,
                        principalTable: "QUIZ_ATTEMPT",
                        principalColumn: "attempt_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ANSWER_question_id",
                table: "ANSWER",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_ATTEMPT_ANSWER_answer_id",
                table: "ATTEMPT_ANSWER",
                column: "answer_id");

            migrationBuilder.CreateIndex(
                name: "IX_ATTEMPT_ANSWER_attempt_id",
                table: "ATTEMPT_ANSWER",
                column: "attempt_id");

            migrationBuilder.CreateIndex(
                name: "IX_ATTEMPT_ANSWER_question_id",
                table: "ATTEMPT_ANSWER",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_QUESTION_question_bank_id",
                table: "QUESTION",
                column: "question_bank_id");

            migrationBuilder.CreateIndex(
                name: "IX_QUESTION_status",
                table: "QUESTION",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_QUESTION_BANK_owner_id",
                table: "QUESTION_BANK",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_is_published_status_created_at",
                table: "QUIZ",
                columns: new[] { "is_published", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_owner_id",
                table: "QUIZ",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_ATTEMPT_is_trial_guest_identifier",
                table: "QUIZ_ATTEMPT",
                columns: new[] { "is_trial", "guest_identifier" });

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_ATTEMPT_quiz_id",
                table: "QUIZ_ATTEMPT",
                column: "quiz_id");

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_ATTEMPT_user_id_submitted_at",
                table: "QUIZ_ATTEMPT",
                columns: new[] { "user_id", "submitted_at" });

            migrationBuilder.CreateIndex(
                name: "IX_QUIZ_QUESTION_question_id",
                table: "QUIZ_QUESTION",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_USER_email",
                table: "USER",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_username",
                table: "USER",
                column: "username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ATTEMPT_ANSWER");

            migrationBuilder.DropTable(
                name: "QUIZ_QUESTION");

            migrationBuilder.DropTable(
                name: "ANSWER");

            migrationBuilder.DropTable(
                name: "QUIZ_ATTEMPT");

            migrationBuilder.DropTable(
                name: "QUESTION");

            migrationBuilder.DropTable(
                name: "QUIZ");

            migrationBuilder.DropTable(
                name: "QUESTION_BANK");

            migrationBuilder.DropTable(
                name: "USER");
        }
    }
}
