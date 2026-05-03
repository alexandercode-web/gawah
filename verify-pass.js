import bcrypt from 'bcryptjs';

async function verify() {
  const hash = '$2b$10$Tq0B/pR4j8TSR40uEYP2ReDkEmAIULLUaaJedkt5GQj2qGbuoNL/.';
  const match = await bcrypt.compare('admin123', hash);
  console.log('Matches admin123:', match);
}

verify();
