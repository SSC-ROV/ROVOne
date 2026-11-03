-- Team roster: school email -> English name and nickname. Display names are "Nickname (Full Name)".
CREATE TABLE IF NOT EXISTS member_roster (
  email TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT ''
);
ALTER TABLE member_roster ENABLE ROW LEVEL SECURITY;
INSERT INTO member_roster (email, full_name, nickname) VALUES
  ('s2026101@stu.ssc.edu.hk', 'Yin Zihao', ''),
  ('s2026066@stu.ssc.edu.hk', 'Ngai Tse Yiu Anson', 'Anson'),
  ('s2025031@stu.ssc.edu.hk', 'Ho Hin Ting Quinton', 'Quinton'),
  ('s2025038@stu.ssc.edu.hk', 'Lam Joshua', 'Joshua'),
  ('s2025062@stu.ssc.edu.hk', 'Ngai Pak Yin', 'Garson'),
  ('s2025028@stu.ssc.edu.hk', 'Gao Tianqi', 'Terry'),
  ('s2025033@stu.ssc.edu.hk', 'Huang Junwen', 'Jasper'),
  ('s2025076@stu.ssc.edu.hk', 'To Lut Wang', 'Lewis'),
  ('s2025079@stu.ssc.edu.hk', 'Wang Jie', 'Wang Jie'),
  ('s2025026@stu.ssc.edu.hk', 'Fu William', 'William'),
  ('s2025027@stu.ssc.edu.hk', 'Gao Ruize', 'Timothy'),
  ('s2025236@stu.ssc.edu.hk', 'Lam Tsz Ching Mattias', 'Mattias'),
  ('s2025165@stu.ssc.edu.hk', 'Shang Ching Yuk', ''),
  ('s2025037@stu.ssc.edu.hk', 'Lam Cheuk Hei', 'Heicus'),
  ('s2024047@stu.ssc.edu.hk', 'Li Yat Ham', 'Harry'),
  ('s2024072@stu.ssc.edu.hk', 'Tai Kit Ming', 'Jimmy'),
  ('s2024068@stu.ssc.edu.hk', 'Song Jiatong', ''),
  ('s2024006@stu.ssc.edu.hk', 'Chan Pak Hei', 'Daniel'),
  ('s2024163@stu.ssc.edu.hk', 'Ng Lok Yin Lorrie', 'Lorrie'),
  ('s2024016@stu.ssc.edu.hk', 'Choi Pui Ho', 'Demarcus'),
  ('s2024061@stu.ssc.edu.hk', 'Ng Yuksun Rafael', 'Rafael'),
  ('s2024018@stu.ssc.edu.hk', 'Chung Ho Fung', 'Jayden'),
  ('s2024030@stu.ssc.edu.hk', 'Hui Sheung Chun', 'Avis'),
  ('s2024101@stu.ssc.edu.hk', 'Chan Wing Lam', 'Dora'),
  ('s2024057@stu.ssc.edu.hk', 'Ng Chung To', ''),
  ('s2023084@stu.ssc.edu.hk', 'Ng Yin Ting', 'Alvin'),
  ('s2023041@stu.ssc.edu.hk', 'Hong Zihan', 'Henry'),
  ('s2023236@stu.ssc.edu.hk', 'Chung Chi Yat', 'Kaden'),
  ('s2023059@stu.ssc.edu.hk', 'Law Choi Yan', 'James'),
  ('s2023235@stu.ssc.edu.hk', 'Leung Kai Ming', 'Kaiser'),
  ('s2023069@stu.ssc.edu.hk', 'Liu Pak Hei Jude Asher', 'Jude'),
  ('s2023187@stu.ssc.edu.hk', 'Zhang Xin Yu', 'Audrey'),
  ('s2023058@stu.ssc.edu.hk', 'Lau Yui Jovan', 'Jovan'),
  ('s2023079@stu.ssc.edu.hk', 'Mok Ting Kai', 'Nathaniel'),
  ('s2023111@stu.ssc.edu.hk', 'Wong Yi Shek Isaac', 'Isaac'),
  ('s2023176@stu.ssc.edu.hk', 'Wang Hing Yuen Demi', 'Demi'),
  ('s2022085@stu.ssc.edu.hk', 'Qiu Jia Da', 'Jason'),
  ('s2022114@stu.ssc.edu.hk', 'Yu Luning Lurin', 'Lurin'),
  ('s2022125@stu.ssc.edu.hk', 'Chen Xinhui', 'Cindy'),
  ('s2024211@stu.ssc.edu.hk', 'Li Jin', 'Li Jin'),
  ('s2021060@stu.ssc.edu.hk', 'Li Jiale', 'Li Jiale')
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, nickname = EXCLUDED.nickname;

UPDATE users u
SET display_name = CASE WHEN r.nickname <> '' AND r.nickname <> r.full_name THEN r.nickname || ' (' || r.full_name || ')' ELSE r.full_name END
FROM member_roster r WHERE lower(u.email) = r.email;

-- Assign the imported "Float v1" tasks led by Kaden (s2023236) to Kaden's account.
UPDATE tasks t SET assignee_id = u.id
FROM users u, cycles c
WHERE u.email = 's2023236@stu.ssc.edu.hk' AND c.id = t.cycle_id AND c.title = 'Float v1'
  AND t.assignee_id IS NULL AND t.description LIKE '%Lead: Kaden%';
