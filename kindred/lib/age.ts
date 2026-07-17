// Age is computed rather than stored: a stored age is wrong within a year.
// profiles.birth_date to calc age; see prisma/schema.prisma.
//
// Shared by the profile page (display) and the onboarding action (validation),
// so both agree on what a birthday means.
export function ageFrom(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }
    return age;
}