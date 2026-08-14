import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class AiQueryDto {
  @IsString()
  @IsNotEmpty({ message: "Query cannot be empty" })
  @MaxLength(1000)
  query: string;
}
