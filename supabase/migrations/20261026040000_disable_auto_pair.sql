-- 친구 연결은 초대 코드(connect_with_code)로만 한다. 모르는 사람이 먼저 가입해 짝이 되는 일을 막기 위해
-- 자동 연결 함수 connect_partner 를 아무도 실행하지 못하게 한다. (함수 자체는 남겨 둔다.)
revoke execute on function public.connect_partner() from public, anon, authenticated;
