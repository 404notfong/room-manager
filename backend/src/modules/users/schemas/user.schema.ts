import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRole } from '../../../common/constants/enums';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({ required: true, trim: true })
    fullName: string;

    @Prop({ trim: true })
    phone: string;

    @Prop({ type: String, enum: UserRole, default: UserRole.OWNER })
    role: UserRole;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop()
    refreshToken?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ isDeleted: 1, isActive: 1 });
