// Namespace của các tầng mà QuizApp.Api sử dụng (Clean Architecture):
//   Api -> Infrastructure -> Application -> Domain
global using QuizApp.Api.Security;
global using QuizApp.Application;
global using QuizApp.Application.Abstractions;
global using QuizApp.Application.Common;
global using QuizApp.Application.Dtos;
global using QuizApp.Domain.Entities;
global using QuizApp.Domain.Enums;
global using QuizApp.Infrastructure;
global using QuizApp.Infrastructure.Persistence;
global using QuizApp.Infrastructure.Security;
